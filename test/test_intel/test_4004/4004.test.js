/**
 * Intel 4004 emulator chip — TDD spec.
 *
 * The 4004 is electrically the most exotic chip on the list:
 *   - 4-bit data bus on D0..D3 multiplexed with addresses across an
 *     8-cycle instruction frame (A1, A2, A3, M1, M2, X1, X2, X3).
 *   - SYNC pulses to mark the start of each instruction frame.
 *   - Two-phase clock (CLK1, CLK2).
 *   - 16 pins total.
 *
 * Because the bus is so different from the 8080/Z80, we don't reuse the
 * fake-ROM helper. Tests here observe the bus phase-by-phase.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BoardHarness } from '../src/BoardHarness.js';
import { chipWasmExists } from '../src/helpers.js';

const CHIP = '4004';
const skip = !chipWasmExists(CHIP);

const CLOCK_HZ = 740_000;
const CLOCK_NS = Math.round(1e9 / CLOCK_HZ);

function fullPinMap() {
  const m = {
    SYNC: 'SYNC', RESET: 'RESET', TEST: 'TEST',
    CMROM: 'CMROM',
    CMRAM0: 'CMRAM0', CMRAM1: 'CMRAM1', CMRAM2: 'CMRAM2', CMRAM3: 'CMRAM3',
    CLK1: 'CLK1', CLK2: 'CLK2',
    VDD: 'VDD', VSS: 'VSS',
  };
  for (let i = 0; i < 4; i++) m[`D${i}`] = `D${i}`;
  return m;
}

async function bootChip(board) {
  await board.addChip(CHIP, fullPinMap());
  board.setNet('TEST', false);
  // Pulse RESET high then low
  board.setNet('RESET', true);
  board.advanceNanos(CLOCK_NS * 10);
  board.setNet('RESET', false);
  board.advanceNanos(CLOCK_NS * 4);
}

describe('Intel 4004 chip', () => {

  describe('pin contract', () => {
    it.skipIf(skip)('registers all 16 logical pins', async () => {
      const board = new BoardHarness();
      await expect(board.addChip(CHIP, fullPinMap())).resolves.toBeDefined();
      board.dispose();
    });
  });

  describe('instruction-cycle frame', () => {
    it.skipIf(skip)('asserts SYNC once every 8 clock cycles', async () => {
      const board = new BoardHarness();
      await bootChip(board);

      const syncTimes = [];
      board.watchNet('SYNC', (high) => {
        if (high) syncTimes.push(board.nowNanos);
      });

      // Run 24 clock cycles → expect ≈ 3 SYNC pulses.
      for (let i = 0; i < 24; i++) board.advanceNanos(CLOCK_NS);

      expect(syncTimes.length, 'SYNC pulses in 24 cycles').toBeGreaterThanOrEqual(2);
      // Spacing should be ~8 cycles between pulses.
      if (syncTimes.length >= 2) {
        const gap = Number(syncTimes[1] - syncTimes[0]);
        expect(gap).toBeGreaterThan(CLOCK_NS * 6);
        expect(gap).toBeLessThan(CLOCK_NS * 10);
      }
      board.dispose();
    });

    it.skipIf(skip)('drives D0..D3 with 12-bit address across A1, A2, A3 phases', async () => {
      const board = new BoardHarness();
      await bootChip(board);

      // After RESET the PC is 0. The first three nibbles after SYNC
      // should all be 0 (low addr nibble first, by 4004 convention).
      const samples = [];
      let sinceSync = -1;
      board.watchNet('SYNC', (high) => { if (high) sinceSync = 0; });

      // We need to sample D0..D3 once per clock cycle. The runtime fires
      // pin watchers on changes only, so we step the clock and read.
      for (let i = 0; i < 10; i++) {
        board.advanceNanos(CLOCK_NS);
        if (sinceSync >= 0 && sinceSync < 3) {
          samples.push(board.readBus('D', 4));
          sinceSync++;
        }
      }
      expect(samples.length).toBe(3);
      // For PC = 0 all three nibbles are 0.
      expect(samples).toEqual([0, 0, 0]);
      board.dispose();
    });

    it.skipIf(skip)('CM-ROM strobes during M1 phase of an instruction cycle', async () => {
      const board = new BoardHarness();
      await bootChip(board);

      let cmRomSeen = false;
      board.watchNet('CMROM', (high) => { if (high) cmRomSeen = true; });
      for (let i = 0; i < 16; i++) board.advanceNanos(CLOCK_NS);
      expect(cmRomSeen, 'CM-ROM must pulse high during M1').toBe(true);
      board.dispose();
    });
  });

  describe('instruction set', () => {
    it.todo('NOP advances PC by 1');
    it.todo('LDM loads the immediate nibble into the accumulator');
    it.todo('JCN conditionally jumps based on TEST/CY/ACC zero');
    it.todo('FIM loads an 8-bit immediate into a register pair');
    it.todo('JMS pushes return address and jumps');
    it.todo('BBL pops return address into PC');
  });

  describe('integration', () => {
    it.todo('runs a Busicom-style decrement-and-blink program');
  });
});
