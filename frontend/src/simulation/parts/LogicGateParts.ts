/**
 * LogicGateParts.ts — Simulation logic for logic gate components.
 *
 * All gates listen to their input pins via pinManager.onPinChange,
 * compute the boolean output, and drive the Y pin accordingly.
 *
 * 2-input gates: A, B → Y
 * NOT gate:      A    → Y
 */

import { PartSimulationRegistry } from './PartSimulationRegistry';
import type { PartSimulationLogic } from './PartSimulationRegistry';

// ─── Helper ───────────────────────────────────────────────────────────────────

function twoInputGate(
  compute: (a: boolean, b: boolean) => boolean,
): PartSimulationLogic {
  return {
    attachEvents: (element, simulator, getPin) => {
      const pinA = getPin('A');
      const pinB = getPin('B');
      const pinY = getPin('Y');

      if (pinA === null || pinB === null || pinY === null) return () => {};

      let stateA = false;
      let stateB = false;

      const update = () => simulator.setPinState(pinY, compute(stateA, stateB));

      const unsubA = simulator.pinManager.onPinChange(pinA, (_: number, s: boolean) => {
        stateA = s; update();
      });
      const unsubB = simulator.pinManager.onPinChange(pinB, (_: number, s: boolean) => {
        stateB = s; update();
      });

      update(); // Drive Y immediately with initial LOW state

      return () => { unsubA(); unsubB(); };
    },
  };
}

// ─── AND ──────────────────────────────────────────────────────────────────────
PartSimulationRegistry.register('logic-gate-and',  twoInputGate((a, b) => a && b));

// ─── NAND ─────────────────────────────────────────────────────────────────────
PartSimulationRegistry.register('logic-gate-nand', twoInputGate((a, b) => !(a && b)));

// ─── OR ───────────────────────────────────────────────────────────────────────
PartSimulationRegistry.register('logic-gate-or',   twoInputGate((a, b) => a || b));

// ─── NOR ──────────────────────────────────────────────────────────────────────
PartSimulationRegistry.register('logic-gate-nor',  twoInputGate((a, b) => !(a || b)));

// ─── XOR ──────────────────────────────────────────────────────────────────────
PartSimulationRegistry.register('logic-gate-xor',  twoInputGate((a, b) => a !== b));

// ─── NOT (inverter) ───────────────────────────────────────────────────────────
PartSimulationRegistry.register('logic-gate-not', {
  attachEvents: (element, simulator, getPin) => {
    const pinA = getPin('A');
    const pinY = getPin('Y');

    if (pinA === null || pinY === null) return () => {};

    const unsub = simulator.pinManager.onPinChange(pinA, (_: number, s: boolean) => {
      simulator.setPinState(pinY, !s);
    });

    simulator.setPinState(pinY, true); // NOT LOW = HIGH (initial LOW input → HIGH output)

    return unsub;
  },
});
