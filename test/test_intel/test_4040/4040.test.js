/**
 * Intel 4040 emulator chip — TDD spec.
 *
 * The 4040 is a strict superset of the 4004. It adds:
 *   - Interrupts (INT pin, fixed vector — verify exact addr from datasheet)
 *   - Single-step / STOP / STOP-ACK
 *   - Expanded register file (16 → 24 4-bit registers)
 *   - Deeper PC stack (3 → 7)
 *   - 14 new opcodes (interrupt enable/disable, return-from-interrupt,
 *     stop, additional register-pair ops)
 *   - 24-pin DIP, 2 CM-ROM lines (vs 1 on 4004)
 *
 * Tests focus on the deltas from 4004. The shared 4004-subset behavior
 * should be exercised by a parametrised re-run of test_4004's suite once
 * both chips are implemented (deferred).
 */
import { describe, it, expect } from 'vitest';
import { BoardHarness } from '../src/BoardHarness.js';
import { chipWasmExists } from '../src/helpers.js';

const CHIP = '4040';
const skip = !chipWasmExists(CHIP);

const CLOCK_HZ = 740_000;
const CLOCK_NS = Math.round(1e9 / CLOCK_HZ);

function fullPinMap() {
  // NOTE: pin names below are best-known; cross-check against an Intel
  // 4040 datasheet before the chip implementation locks them down.
  const m = {
    SYNC: 'SYNC', RESET: 'RESET', TEST: 'TEST',
    CMROM0: 'CMROM0', CMROM1: 'CMROM1',
    CMRAM0: 'CMRAM0', CMRAM1: 'CMRAM1', CMRAM2: 'CMRAM2', CMRAM3: 'CMRAM3',
    CLK1: 'CLK1', CLK2: 'CLK2',
    INT: 'INT',
    STOP: 'STOP', STOPACK: 'STOPACK',
    VDD: 'VDD', VSS: 'VSS',
  };
  for (let i = 0; i < 4; i++) m[`D${i}`] = `D${i}`;
  return m;
}

describe('Intel 4040 chip', () => {

  describe('pin contract', () => {
    it.skipIf(skip)('registers the 24-pin contract (4004 superset)', async () => {
      const board = new BoardHarness();
      await expect(board.addChip(CHIP, fullPinMap())).resolves.toBeDefined();
      board.dispose();
    });
  });

  describe('STOP / STOP-ACK', () => {
    it.skipIf(skip)('asserting STOP halts SYNC pulses and asserts STOPACK', async () => {
      const board = new BoardHarness();
      await board.addChip(CHIP, fullPinMap());

      // Reset and run a few cycles freely.
      board.setNet('RESET', true);
      board.advanceNanos(CLOCK_NS * 10);
      board.setNet('RESET', false);
      for (let i = 0; i < 16; i++) board.advanceNanos(CLOCK_NS);

      // Now assert STOP and watch.
      board.setNet('STOP', true);
      // Wait for the chip to acknowledge.
      let acked = false;
      board.watchNet('STOPACK', (high) => { if (high) acked = true; });

      let syncAfter = 0;
      board.watchNet('SYNC', (high) => { if (high) syncAfter++; });

      for (let i = 0; i < 24; i++) board.advanceNanos(CLOCK_NS);

      expect(acked, 'STOPACK must rise within ~one instruction cycle').toBe(true);
      expect(syncAfter, 'SYNC pulses must stop after STOPACK').toBeLessThanOrEqual(1);
      board.dispose();
    });
  });

  describe('interrupts', () => {
    it.todo('rising edge on INT vectors PC to the documented interrupt entry address');
    it.todo('return-from-interrupt opcode restores PC + flags');
  });

  describe('extended register file', () => {
    it.todo('FIM works on registers R16..R23 (4040-only range)');
  });
});
