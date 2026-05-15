/**
 * NgSpiceNodeAdapter — SolverPort implementation that runs the
 * vendored ngspice WASM directly in the Vitest Node process, no
 * Web Worker required.
 *
 * Architecture:
 *   loadNgSpiceForNode → emscripten Module (with _velxio_fs et al.
 *   patched on)
 *   ↓
 *   stageFilesystem — write the .cm files + spinit to the WASM FS
 *   ↓
 *   bindApi — Module.cwrap the C functions we need
 *   ↓
 *   initialiseNgspice — register callbacks, call ngSpice_Init,
 *   set xspice, source /spinit
 *
 * Once initialised, SolverPort methods translate domain calls to
 * ngspice commands and read results via ngGet_Vec_Info.
 *
 * Concurrency: ngspice C API is not thread-safe; this adapter
 * serialises every call.  Vitest's worker-per-test-file isolation
 * means each test file gets a fresh process and adapter.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  SolverPort,
  SolveAnalysis,
  SolveResult,
  SolveOptions,
  SolveVector,
} from '../ports/SolverPort';
import {
  loadNgSpiceForNode,
  type NgSpiceEmscriptenModule,
} from './node/loadNgSpiceForNode';

const MODEL_FILES = [
  'analog.cm',
  'digital.cm',
  'spice2poly.cm',
  'table.cm',
  'tlines.cm',
  'xtradev.cm',
  'xtraevt.cm',
];

// ngspice vector_info struct field offsets (32-bit pointers).
// Confirmed against the live struct dump from the vendored build.
const VECTOR_INFO_FLAGS_OFFSET = 8;
const VECTOR_INFO_REALDATA_OFFSET = 12;
const VECTOR_INFO_IMAGDATA_OFFSET = 16;
const VECTOR_INFO_LENGTH_OFFSET = 20;
const VECTOR_FLAG_COMPLEX = 1 << 1;

interface NgSpiceApi {
  init: (
    print: number,
    status: number,
    exit: number,
    data: number,
    dataInit: number,
    bg: number,
    arg: number,
  ) => number;
  command: (cmd: string) => number;
  circ: (linesPtr: number) => number;
  allVecs: (plot: string) => number;
  curPlot: () => string;
  getVecInfo: (name: string) => number;
  reset: () => number;
  nospiceinit: () => number;
  setInputPath: (path: string) => number;
}

function defaultWasmDir(): string {
  const here = fileURLToPath(import.meta.url);
  return path.resolve(here, '../../../../../public/wasm/ngspice-interactive');
}

export class NgSpiceNodeAdapter implements SolverPort {
  private module: NgSpiceEmscriptenModule | null = null;
  private api: NgSpiceApi | null = null;
  private initialised = false;
  private initPromise: Promise<void> | null = null;
  private readonly wasmDir: string;
  private stdoutBuffer: string[] = [];
  private stderrBuffer: string[] = [];
  private callbackPointers: number[] = [];

  constructor(opts: { wasmDir?: string } = {}) {
    this.wasmDir = opts.wasmDir ?? defaultWasmDir();
  }

  async init(): Promise<void> {
    if (this.initialised) return;
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      this.module = await loadNgSpiceForNode({
        wasmDir: this.wasmDir,
        onStdout: (text) => this.stdoutBuffer.push(text),
        onStderr: (text) => this.stderrBuffer.push(text),
      });
      this.bindApi();
      this.registerCallbacks();
      this.stageFilesystem();
      this.initialiseNgspice();
      this.initialised = true;
    })();
    return this.initPromise;
  }

  private bindApi(): void {
    if (!this.module) throw new Error('Module not ready');
    const M = this.module;
    this.api = {
      init: M.cwrap('ngSpice_Init', 'number', [
        'number', 'number', 'number', 'number', 'number', 'number', 'number',
      ]),
      command: M.cwrap('ngSpice_Command', 'number', ['string']),
      circ: M.cwrap('ngSpice_Circ', 'number', ['number']),
      allVecs: M.cwrap('ngSpice_AllVecs', 'number', ['string']),
      curPlot: M.cwrap('ngSpice_CurPlot', 'string', []),
      getVecInfo: M.cwrap('ngGet_Vec_Info', 'number', ['string']),
      reset: M.cwrap('ngSpice_Reset', 'number', []),
      nospiceinit: M.cwrap('ngSpice_nospiceinit', 'number', []),
      setInputPath: M.cwrap('ngCM_Input_Path', 'number', ['string']),
    };
  }

  private registerCallbacks(): void {
    if (!this.module) throw new Error('Module not ready');
    const M = this.module;
    // ngspice C callback signatures (from sharedspice.h):
    //   SendChar(char*, int, void*)             → 4 ints (i ptr, i id, ptr) but emscripten counts ptrs as i
    //   SendStat(char*, int, void*)             → iiii
    //   ControlledExit(int, bool, bool, int, void*) → iiiiii
    //   SendData(vecvaluesall*, int, int, void*) → iiiii
    //   SendInitData(vecinfoall*, int, void*)   → iiii
    //   BGThreadRunning(bool, int, void*)       → iiii
    const noop = () => 0;
    this.callbackPointers = [
      M.addFunction(noop, 'iiii'),    // print
      M.addFunction(noop, 'iiii'),    // status
      M.addFunction(noop, 'iiiiii'),  // exit
      M.addFunction(noop, 'iiiii'),   // data
      M.addFunction(noop, 'iiii'),    // dataInit
      M.addFunction(noop, 'iiii'),    // bg
    ];
  }

  private stageFilesystem(): void {
    const M = this.module;
    if (!M || !M._velxio_fs) throw new Error('Module FS not ready');
    const FS = M._velxio_fs;
    // Recursive mkdir — emscripten FS.mkdir is one level at a time
    // and the default mounted root only has `/`.
    const ensureDir = (full: string): void => {
      const parts = full.split('/').filter((p) => p.length > 0);
      let cur = '';
      for (const p of parts) {
        cur += '/' + p;
        try { FS.mkdir(cur); } catch { /* exists */ }
      }
    };
    ensureDir('/usr/local/lib/ngspice');
    ensureDir('/usr/local/share/ngspice/scripts');

    for (const name of MODEL_FILES) {
      const data = readFileSync(path.join(this.wasmDir, name));
      FS.writeFile(`/usr/local/lib/ngspice/${name}`, new Uint8Array(data));
    }
    const spinit = readFileSync(path.join(this.wasmDir, 'spinit'), 'utf8');
    FS.writeFile('/usr/local/share/ngspice/scripts/spinit', spinit);
    FS.writeFile('/spinit', spinit);
  }

  private initialiseNgspice(): void {
    if (!this.api) throw new Error('API not ready');
    this.api.nospiceinit();
    // Pass 0 (null) for every callback — ngspice tolerates null and
    // skips the corresponding event.  This sidesteps a
    // "function signature mismatch" we hit when feeding addFunction
    // pointers; investigate the worker's exact emscripten build
    // settings later if we need real callbacks (progress / stderr).
    const rc = this.api.init(0, 0, 0, 0, 0, 0, 0);
    if (rc !== 0) throw new Error(`ngSpice_Init returned ${rc}`);
    this.api.setInputPath('/');
    this.api.command('set xspice_enabled');
    this.api.command('source /spinit');
  }

  async loadCircuit(netlist: string): Promise<void> {
    await this.init();
    if (!this.module || !this.api || !this.module._velxio_fs) throw new Error('not ready');
    // The build doesn't export `_malloc`, so we can't construct the
    // char** the `ngSpice_Circ` API needs from JS. Workaround: write
    // the netlist to the virtual FS and ask ngspice to `source` it.
    this.module._velxio_fs.writeFile('/circuit.spc', netlist);
    const rc = this.api.command('source /circuit.spc');
    if (rc !== 0) throw new Error(`source /circuit.spc returned ${rc}`);
  }

  async solve(analysis: SolveAnalysis, options: SolveOptions): Promise<SolveResult> {
    await this.init();
    if (!this.api) throw new Error('not ready');
    const t0 = performance.now();
    this.stderrBuffer.length = 0;
    this.stdoutBuffer.length = 0;

    // ngspice has two ways to run an analysis:
    //   .control / .endc block in the netlist (ran by 'source')
    //   bare `op` / `tran ...` / `ac ...` commands after sourcing
    // Bare commands often fail silently in interactive mode unless
    // a circuit is "current"; the safer pattern is to inject the
    // analysis directive INTO the netlist before source. But since
    // the source already ran, we issue `run` which runs whatever
    // last `.tran` / `.op` directive was in the netlist + falls
    // back to our manual analysis card.
    const cmd = (() => {
      switch (analysis.kind) {
        case 'op': return 'op';
        case 'tran': return `tran ${analysis.step} ${analysis.stop}`;
        case 'ac': return `ac ${analysis.sweep} ${analysis.points} ${analysis.fstart} ${analysis.fstop}`;
      }
    })();
    const rc = this.api.command(cmd);
    if (rc !== 0) throw new Error(`ngspice command '${cmd}' returned ${rc}`);


    const vectors = new Map<string, SolveVector>();
    let timeAxis: Float64Array = new Float64Array(0);

    for (const name of options.vectorsOfInterest) {
      const vec = this.readVector(name);
      if (vec) vectors.set(name.toLowerCase(), vec);
    }
    if (analysis.kind === 'tran') {
      const t = this.readVector('time');
      if (t) timeAxis = t.real;
    }

    const solveMs = performance.now() - t0;
    return {
      analysis,
      vectors,
      timeAxis,
      solveMs,
      warnings: [...this.stderrBuffer, ...this.stdoutBuffer.map((s) => `stdout: ${s}`)],
    };
  }

  async alterSource(name: string, dcValue: number): Promise<void> {
    await this.init();
    if (!this.api) throw new Error('not ready');
    this.api.command(`alter ${name} dc ${dcValue}`);
  }

  dispose(): void {
    if (this.api) {
      try { this.api.reset(); } catch { /* ignore */ }
    }
    this.initialised = false;
    this.initPromise = null;
  }

  private readVector(name: string): SolveVector | null {
    if (!this.module || !this.api) return null;
    const M = this.module;
    let infoPtr = this.api.getVecInfo(name);
    if (!infoPtr && !name.includes('.')) {
      const plot = this.api.curPlot();
      if (plot) infoPtr = this.api.getVecInfo(`${plot}.${name}`);
    }
    if (!infoPtr) return null;
    const heap32 = M._velxio_heap32;
    const heapu32 = M._velxio_heapu32;
    const heapf64 = M._velxio_heapf64;
    if (!heap32 || !heapu32 || !heapf64) return null;
    const realDataPtr = heapu32[(infoPtr + VECTOR_INFO_REALDATA_OFFSET) >> 2]!;
    const imagDataPtr = heapu32[(infoPtr + VECTOR_INFO_IMAGDATA_OFFSET) >> 2]!;
    const length = heap32[(infoPtr + VECTOR_INFO_LENGTH_OFFSET) >> 2]!;
    const flags = heap32[(infoPtr + VECTOR_INFO_FLAGS_OFFSET) >> 2]!;
    const complex = (flags & VECTOR_FLAG_COMPLEX) !== 0;
    if (!realDataPtr || length <= 0) return null;
    const real = new Float64Array(heapf64.buffer, realDataPtr, length).slice();
    const imag = complex && imagDataPtr
      ? new Float64Array(heapf64.buffer, imagDataPtr, length).slice()
      : null;
    return { name: name.toLowerCase(), real, imag };
  }
}
