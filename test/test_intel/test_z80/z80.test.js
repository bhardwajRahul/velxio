/**
 * Zilog Z80 emulator chip — TDD spec.
 *
 * The Z80 is binary-compatible with the 8080 plus extensions, so the
 * 8080 tests' structure carries over. This file focuses on:
 *   1. The Z80-specific bus protocol (M1̅ / MREQ̅ / IORQ̅ / RFSH̅)
 *   2. Z80-only instructions (EX, EXX, DJNZ, IX/IY, block ops, IM 0-2)
 *   3. NMI behaviour (pushes PC, vectors to 0x0066)
 *
 * The 8080-subset instructions are NOT re-tested here — once both chips
 * are implemented, a shared "8080-subset suite" should run against both.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BoardHarness } from '../src/BoardHarness.js';
import { chipWasmExists, hex8, hex16 } from '../src/helpers.js';

const CHIP = 'z80';
const skip = !chipWasmExists(CHIP);

const CLOCK_HZ = 4_000_000;
const CLOCK_NS = Math.round(1e9 / CLOCK_HZ);

function fullPinMap() {
  const m = {
    M1: 'M1', MREQ: 'MREQ', IORQ: 'IORQ', RD: 'RD', WR: 'WR', RFSH: 'RFSH',
    HALT: 'HALT', WAIT: 'WAIT', INT: 'INT', NMI: 'NMI', RESET: 'RESET',
    BUSREQ: 'BUSREQ', BUSACK: 'BUSACK', CLK: 'CLK',
    VCC: 'VCC', GND: 'GND',
  };
  for (let i = 0; i < 16; i++) m[`A${i}`] = `A${i}`;
  for (let i = 0; i < 8;  i++) m[`D${i}`] = `D${i}`;
  return m;
}

async function bootZ80(program) {
  const board = new BoardHarness();
  await board.addChip(CHIP, fullPinMap());

  board.installFakeRom(program, {
    addrPrefix: 'A', addrWidth: 16,
    dataPrefix: 'D', dataWidth: 8,
    rd: 'RD', rdActiveLow: true,
    cs: 'MREQ',                       // only respond when MREQ̅ is asserted
    csActiveLow: true,
    baseAddr: 0,
  });

  const ram = board.installFakeRam(0x8000, {
    addrPrefix: 'A', addrWidth: 16,
    dataPrefix: 'D', dataWidth: 8,
    rd: 'RD', wr: 'WR',
    cs: 'MREQ',
    baseAddr: 0x8000,
  });

  board.setNet('WAIT',   true);   // not waiting
  board.setNet('INT',    true);   // INT̅ deasserted (active-low on Z80)
  board.setNet('NMI',    true);   // NMI̅ deasserted
  board.setNet('BUSREQ', true);
  board.setNet('RESET',  false);
  board.advanceNanos(CLOCK_NS * 4);
  board.setNet('RESET',  true);
  board.advanceNanos(CLOCK_NS * 2);
  return { board, ram };
}

describe('Zilog Z80 chip', () => {

  describe('pin contract', () => {
    it.skipIf(skip)('registers all 40 named pins', async () => {
      const board = new BoardHarness();
      await expect(board.addChip(CHIP, fullPinMap())).resolves.toBeDefined();
      board.dispose();
    });
  });

  describe('reset', () => {
    it.skipIf(skip)('first M1 fetch is from 0x0000', async () => {
      const board = new BoardHarness();
      await board.addChip(CHIP, fullPinMap());

      const m1Fetches = [];
      board.watchNet('M1', (low) => {
        if (low === false) m1Fetches.push(board.readBus('A', 16));
      });
      board.installFakeRom([0x00, 0x00, 0x76], {  // NOP NOP HALT
        rd: 'RD', cs: 'MREQ', csActiveLow: true,
      });
      board.setNet('WAIT', true);
      board.setNet('INT', true);
      board.setNet('NMI', true);
      board.setNet('BUSREQ', true);
      board.setNet('RESET', false);
      board.advanceNanos(CLOCK_NS * 4);
      board.setNet('RESET', true);
      board.advanceNanos(CLOCK_NS * 30);

      expect(m1Fetches[0], 'first M1 fetch').toBe(0x0000);
      board.dispose();
    });
  });

  describe('M1 cycle', () => {
    it.skipIf(skip)('asserts M1̅ + MREQ̅ + RD̅ during opcode fetch', async () => {
      const board = new BoardHarness();
      await board.addChip(CHIP, fullPinMap());

      let sawAllAsserted = false;
      board.watchNet('M1', (state) => {
        if (state === false) {
          // Snap the other signals at the same instant
          if (board.getNet('MREQ') === false && board.getNet('RD') === false) {
            sawAllAsserted = true;
          }
        }
      });
      board.installFakeRom([0x00, 0x76], { rd: 'RD', cs: 'MREQ', csActiveLow: true });
      board.setNet('WAIT', true);
      board.setNet('INT', true); board.setNet('NMI', true); board.setNet('BUSREQ', true);
      board.setNet('RESET', false);
      board.advanceNanos(CLOCK_NS * 4);
      board.setNet('RESET', true);
      board.advanceNanos(CLOCK_NS * 30);

      expect(sawAllAsserted, 'M1̅, MREQ̅, RD̅ asserted simultaneously during fetch').toBe(true);
      board.dispose();
    });

    it.skipIf(skip)('asserts RFSH̅ during the refresh phase of M1', async () => {
      const board = new BoardHarness();
      await board.addChip(CHIP, fullPinMap());

      let rfshSeen = false;
      board.watchNet('RFSH', (state) => { if (state === false) rfshSeen = true; });
      board.installFakeRom([0x00, 0x00, 0x76], { rd: 'RD', cs: 'MREQ', csActiveLow: true });
      board.setNet('WAIT', true); board.setNet('INT', true);
      board.setNet('NMI', true); board.setNet('BUSREQ', true);
      board.setNet('RESET', false);
      board.advanceNanos(CLOCK_NS * 4);
      board.setNet('RESET', true);
      board.advanceNanos(CLOCK_NS * 30);

      expect(rfshSeen, 'RFSH̅ must pulse low after M1 fetch').toBe(true);
      board.dispose();
    });
  });

  describe('Z80-only instructions', () => {
    // Z80 mnemonic constants — only those used in tests below.
    const LD_A_n   = 0x3E;
    const LD_BC_nn = 0x01;
    const LD_DE_nn = 0x11;
    const LD_HL_nn = 0x21;
    const LD_IX_nn = 0xDD; const _IX_LD_nn = 0x21;   // DD 21 nn nn
    const EX_DE_HL = 0xEB;
    const EXX      = 0xD9;
    const DJNZ     = 0x10;
    const LDIR     = 0xED; const _LDIR = 0xB0;       // ED B0
    const LD_aHL_n = 0x36;
    const LD_addr_A = 0x32;
    const HALT     = 0x76;

    it.skipIf(skip)('EX DE, HL swaps register pairs', async () => {
      // LD HL, 0x1234 ; LD DE, 0x5678 ; EX DE, HL ; LD (0x8000), A is awkward
      // because we can't read HL/DE directly. Use this instead:
      // LD HL, 0xAA00 ; LD DE, 0xBB00 ; EX DE, HL ; LD (HL), 0x77 ; HALT
      // After EX, HL = 0xBB00 (in our RAM range) so we write to 0xBB00.
      // Wait, 0xBB00 is in our RAM (0x8000+) — yes.
      const program = new Uint8Array([
        LD_HL_nn, 0x00, 0xAA,
        LD_DE_nn, 0x00, 0xBB,
        EX_DE_HL,
        LD_aHL_n, 0x77,
        HALT,
      ]);
      const { board, ram } = await bootZ80(program);
      for (let i = 0; i < 200; i++) board.advanceNanos(CLOCK_NS);
      expect(ram.peek(0xBB00)).toBe(0x77);
      board.dispose();
    });

    it.skipIf(skip)('DJNZ decrements B and jumps while non-zero', async () => {
      // LD A, 0 ; LD B, 5 ; LOOP: INC A ; DJNZ LOOP ; LD (0x8000), A ; HALT
      // Expected: A = 5 stored at 0x8000.
      const INC_A = 0x3C;
      const program = new Uint8Array([
        LD_A_n, 0x00,
        0x06, 0x05,                        // LD B, 5
        INC_A,                             // LOOP:
        DJNZ, 0xFD,                        // jump back -3 to LOOP
        LD_addr_A, 0x00, 0x80,             // LD (0x8000), A
        HALT,
      ]);
      const { board, ram } = await bootZ80(program);
      for (let i = 0; i < 500; i++) board.advanceNanos(CLOCK_NS);
      expect(ram.peek(0x8000)).toBe(5);
      board.dispose();
    });

    it.todo('LDIR copies a memory block from HL to DE');
    it.todo('LD A, (IX+d) reads via IX with signed displacement');
    it.todo('EXX swaps the main register set with the shadow set');
  });

  describe('interrupts', () => {
    it.todo('NMI̅ falling edge pushes PC and vectors to 0x0066');
    it.todo('IM 1 + INT̅ vectors to 0x0038');
    it.todo('IM 2 + INT̅ uses I:byte to vector through a table');
  });

  describe('integration', () => {
    it.todo('runs the public-domain ZEXDOC test ROM (documented flags)');
  });
});
