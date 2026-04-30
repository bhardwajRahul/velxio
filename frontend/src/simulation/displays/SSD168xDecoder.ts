/**
 * SSD168xDecoder — TypeScript port of the reference SSD168x SPI decoder.
 *
 * Source spec / golden file: `test/test_epaper/ssd168x_decoder.py`. This
 * port is byte-for-byte algorithmically identical so the cross-decoder
 * consistency test (`ssd168x-decoder.test.ts`) can replay the same
 * fixtures through both implementations and assert the same framebuffers.
 *
 * Supports the entire Solomon Systech SSD168x family used by every
 * 1.54"–7.5" ePaper panel in our Phase-1 catalog (SSD1681, SSD1675A,
 * SSD1680, SSD1683). They share ~95 % of the command set; differences
 * are RAM size and which driver-output config bytes are accepted, both
 * orthogonal to this decoder.
 *
 * References:
 *   - SSD1681 datasheet (Adafruit mirror):
 *     https://cdn-learn.adafruit.com/assets/assets/000/099/573/original/SSD1681.pdf
 *   - ESP-BSP command header:
 *     https://github.com/espressif/esp-bsp/blob/master/components/lcd/esp_lcd_ssd1681/esp_lcd_ssd1681_commands.h
 */

// ── Command opcodes (shared across SSD168x family) ───────────────────────────

export const CMD_DRIVER_OUTPUT_CTRL    = 0x01;
export const CMD_GATE_DRIVING_VOLTAGE  = 0x03;
export const CMD_SOURCE_DRIVING_VOLT   = 0x04;
export const CMD_DEEP_SLEEP            = 0x10;
export const CMD_DATA_ENTRY_MODE       = 0x11;
export const CMD_SW_RESET              = 0x12;
export const CMD_TEMP_SENSOR           = 0x18;
export const CMD_MASTER_ACTIVATION     = 0x20;
export const CMD_DISP_UPDATE_CTRL_1    = 0x21;
export const CMD_DISP_UPDATE_CTRL_2    = 0x22;
export const CMD_WRITE_BLACK_VRAM      = 0x24;
export const CMD_WRITE_RED_VRAM        = 0x26;
export const CMD_WRITE_VCOM_REG        = 0x2c;
export const CMD_WRITE_LUT             = 0x32;
export const CMD_BORDER_WAVEFORM       = 0x3c;
export const CMD_END_OPTION            = 0x3f;
export const CMD_SET_RAMX_RANGE        = 0x44;
export const CMD_SET_RAMY_RANGE        = 0x45;
export const CMD_SET_RAMX_COUNTER      = 0x4e;
export const CMD_SET_RAMY_COUNTER      = 0x4f;

// Palette indices used in the composed frame: 0 = black, 1 = white,
// 2 = red (only when the red RAM plane was written).
export type EPaperPalette = 0 | 1 | 2;

export interface Frame {
  width: number;
  height: number;
  /** width*height palette indices. */
  pixels: Uint8Array;
}

export interface SSD168xDecoderOptions {
  width: number;
  height: number;
  /** Fired on every 0x20 MASTER_ACTIVATION with the latched composed frame. */
  onFlush?: (frame: Frame) => void;
}

/**
 * Single-instance state machine. **Not thread-safe** — re-use only via the
 * (single-threaded) JS event loop.
 */
export class SSD168xDecoder {
  readonly width: number;
  readonly height: number;
  private readonly bytesPerRow: number;

  /** B/W RAM plane. 1 bit = 1 px. Bit value 1 = white, 0 = black. */
  bwRam: Uint8Array;
  /** Red RAM plane. 1 bit = 1 px. Bit value 1 = red, 0 = transparent. */
  redRam: Uint8Array;

  private currentCmd = -1;
  private params: number[] = [];
  /** Which RAM plane subsequent data bytes target. */
  private ramTarget: 'bw' | 'red' = 'bw';

  /** Current X position in bytes (1 byte = 8 px). */
  private xByte = 0;
  /** Current Y position (scanline). */
  private y = 0;

  /** Active RAM window in bytes (start, end inclusive). */
  private xrange: [number, number] = [0, 0];
  /** Active RAM window in scanlines (start, end inclusive). */
  private yrange: [number, number] = [0, 0];

  /** Data-entry-mode register (0x11). Default = 0x03 (X+, Y+, X-first). */
  private entryMode = 0x03;

  /** Diagnostics: how many full refresh activations we've seen. */
  refreshedCount = 0;
  /** Diagnostics: opcodes the host emitted that aren't in our table. */
  unknownCmds: number[] = [];
  /** True when the chip has been put into deep sleep. */
  inDeepSleep = false;

  private readonly onFlush?: (frame: Frame) => void;

  constructor(opts: SSD168xDecoderOptions) {
    this.width = opts.width;
    this.height = opts.height;
    this.bytesPerRow = (opts.width + 7) >> 3;
    this.onFlush = opts.onFlush;

    const bwSize = this.bytesPerRow * this.height;
    this.bwRam = new Uint8Array(bwSize).fill(0xff); // default white
    this.redRam = new Uint8Array(bwSize).fill(0x00); // default no red

    this.xrange = [0, this.bytesPerRow - 1];
    this.yrange = [0, this.height - 1];
  }

  // ── Public API ─────────────────────────────────────────────────────

  /**
   * Process one SPI byte. `dcHigh` mirrors the DC pin (false = LOW = command).
   */
  feed(byte: number, dcHigh: boolean): void {
    if (!dcHigh) this.beginCommand(byte & 0xff);
    else this.handleData(byte & 0xff);
  }

  /** Clear all state — equivalent to a hardware RST low pulse. */
  reset(): void {
    this.bwRam.fill(0xff);
    this.redRam.fill(0x00);
    this.currentCmd = -1;
    this.params = [];
    this.ramTarget = 'bw';
    this.xByte = 0;
    this.y = 0;
    this.entryMode = 0x03;
    this.xrange = [0, this.bytesPerRow - 1];
    this.yrange = [0, this.height - 1];
    this.inDeepSleep = false;
  }

  /**
   * Build a Frame from the latched RAM planes. Composition rule:
   *   red plane bit = 1 → RED  (wins over black)
   *   bw plane bit = 1  → WHITE
   *   else              → BLACK
   * (Matches every SSD168x-driving Arduino library.)
   */
  composeFrame(): Frame {
    const out = new Uint8Array(this.width * this.height);
    const bpr = this.bytesPerRow;
    for (let y = 0; y < this.height; y++) {
      for (let xb = 0; xb < bpr; xb++) {
        const bByte = this.bwRam[y * bpr + xb];
        const rByte = this.redRam[y * bpr + xb];
        for (let bit = 0; bit < 8; bit++) {
          const x = (xb << 3) + bit;
          if (x >= this.width) break;
          const mask = 0x80 >> bit;
          const isRed = (rByte & mask) !== 0;
          const isWhite = (bByte & mask) !== 0;
          out[y * this.width + x] = isRed ? 2 : isWhite ? 1 : 0;
        }
      }
    }
    return { width: this.width, height: this.height, pixels: out };
  }

  // ── Internal: command / data dispatch ──────────────────────────────

  private beginCommand(cmd: number): void {
    this.currentCmd = cmd;
    this.params = [];

    switch (cmd) {
      case CMD_SW_RESET:
        this.reset();
        return;
      case CMD_MASTER_ACTIVATION: {
        this.refreshedCount += 1;
        const frame = this.composeFrame();
        this.onFlush?.(frame);
        return;
      }
      case CMD_WRITE_BLACK_VRAM:
        this.ramTarget = 'bw';
        return;
      case CMD_WRITE_RED_VRAM:
        this.ramTarget = 'red';
        return;
      case CMD_DRIVER_OUTPUT_CTRL:
      case CMD_GATE_DRIVING_VOLTAGE:
      case CMD_SOURCE_DRIVING_VOLT:
      case CMD_DEEP_SLEEP:
      case CMD_DATA_ENTRY_MODE:
      case CMD_TEMP_SENSOR:
      case CMD_DISP_UPDATE_CTRL_1:
      case CMD_DISP_UPDATE_CTRL_2:
      case CMD_WRITE_VCOM_REG:
      case CMD_WRITE_LUT:
      case CMD_BORDER_WAVEFORM:
      case CMD_END_OPTION:
      case CMD_SET_RAMX_RANGE:
      case CMD_SET_RAMY_RANGE:
      case CMD_SET_RAMX_COUNTER:
      case CMD_SET_RAMY_COUNTER:
        return;
      default:
        // Unknown opcode — log so users can report panel quirks, but never
        // throw. Real-world firmware sometimes emits vendor-specific bytes.
        this.unknownCmds.push(cmd);
    }
  }

  private handleData(byte: number): void {
    const cmd = this.currentCmd;
    this.params.push(byte);
    const params = this.params;

    if (cmd === CMD_DEEP_SLEEP && params.length === 1) {
      this.inDeepSleep = byte !== 0;
    } else if (cmd === CMD_DATA_ENTRY_MODE && params.length === 1) {
      this.entryMode = byte;
    } else if (cmd === CMD_SET_RAMX_RANGE && params.length === 2) {
      this.xrange = [params[0], params[1]];
      this.xByte = params[0];
    } else if (cmd === CMD_SET_RAMY_RANGE && params.length === 4) {
      this.yrange = [
        params[0] | (params[1] << 8),
        params[2] | (params[3] << 8),
      ];
      this.y = this.yrange[0];
    } else if (cmd === CMD_SET_RAMX_COUNTER && params.length === 1) {
      this.xByte = byte;
    } else if (cmd === CMD_SET_RAMY_COUNTER && params.length === 2) {
      this.y = params[0] | (params[1] << 8);
    } else if (cmd === CMD_WRITE_BLACK_VRAM) {
      this.writeRamByte(this.bwRam, byte);
    } else if (cmd === CMD_WRITE_RED_VRAM) {
      this.writeRamByte(this.redRam, byte);
    }
    // Other commands silently buffer their parameters.
  }

  private writeRamByte(plane: Uint8Array, byte: number): void {
    const bpr = this.bytesPerRow;
    if (
      this.xByte >= 0 &&
      this.xByte < bpr &&
      this.y >= 0 &&
      this.y < this.height
    ) {
      plane[this.y * bpr + this.xByte] = byte;
    }
    // Auto-increment per data_entry_mode (default 0x03: X+, then Y+ at end of row).
    const xInc = (this.entryMode & 0x01) === 0x01;
    if (xInc) {
      if (this.xByte < this.xrange[1]) {
        this.xByte += 1;
      } else {
        this.xByte = this.xrange[0];
        this.y += 1;
      }
    } else {
      if (this.xByte > this.xrange[0]) {
        this.xByte -= 1;
      } else {
        this.xByte = this.xrange[1];
        this.y += 1;
      }
    }
  }
}
