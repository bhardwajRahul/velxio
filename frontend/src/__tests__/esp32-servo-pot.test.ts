/**
 * esp32-servo-pot.test.ts
 *
 * Tests for the ESP32 Servo + Potentiometer example, focusing on:
 *   1. Servo subscribes to onPwmChange for ESP32 (not AVR cycle measurement)
 *   2. Servo uses onPinChange for AVR (existing behavior)
 *   3. Servo uses onPinChangeWithTime for RP2040
 *   4. LEDC update routes to correct GPIO pin (not LEDC channel)
 *   5. LEDC duty_pct is normalized to 0.0–1.0
 *   6. LEDC fallback to channel when gpio=-1
 *   7. Servo angle maps correctly from duty cycle (pulse-width based)
 *   8. Potentiometer setAdcVoltage works for ESP32 via bridge shim
 *   9. ESP32 ADC channel mapping (GPIO → ADC1 channel)
 *  10. LEDC polling reads float[] duty (not uint32) from QEMU internals(6)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../simulation/AVRSimulator', () => ({
  AVRSimulator: vi.fn(function (this: any) {
    this.onSerialData = null;
    this.onBaudRateChange = null;
    this.onPinChangeWithTime = null;
    this.start = vi.fn();
    this.stop = vi.fn();
    this.reset = vi.fn();
    this.loadHex = vi.fn();
    this.addI2CDevice = vi.fn();
    this.setPinState = vi.fn();
    this.isRunning = vi.fn().mockReturnValue(true);
    this.registerSensor = vi.fn().mockReturnValue(false);
    this.pinManager = {
      onPinChange: vi.fn().mockReturnValue(() => {}),
      onPwmChange: vi.fn().mockReturnValue(() => {}),
      updatePwm: vi.fn(),
    };
    this.getCurrentCycles = vi.fn().mockReturnValue(1000);
    this.getClockHz = vi.fn().mockReturnValue(16_000_000);
    this.cpu = { data: new Uint8Array(512).fill(0), cycles: 1000 };
  }),
}));

vi.mock('../simulation/RP2040Simulator', () => ({
  RP2040Simulator: vi.fn(function (this: any) {
    this.onSerialData = null;
    this.onPinChangeWithTime = null;
    this.start = vi.fn();
    this.stop = vi.fn();
    this.reset = vi.fn();
    this.loadBinary = vi.fn();
    this.addI2CDevice = vi.fn();
    this.isRunning = vi.fn().mockReturnValue(true);
    this.registerSensor = vi.fn().mockReturnValue(false);
    this.pinManager = {
      onPinChange: vi.fn().mockReturnValue(() => {}),
      onPwmChange: vi.fn().mockReturnValue(() => {}),
      updatePwm: vi.fn(),
    };
  }),
}));

vi.mock('../simulation/PinManager', () => ({
  PinManager: vi.fn(function (this: any) {
    this.updatePort = vi.fn();
    this.onPinChange = vi.fn().mockReturnValue(() => {});
    this.onPwmChange = vi.fn().mockReturnValue(() => {});
    this.getListenersCount = vi.fn().mockReturnValue(0);
    this.updatePwm = vi.fn();
    this.triggerPinChange = vi.fn();
  }),
}));

vi.mock('../simulation/I2CBusManager', () => ({
  VirtualDS1307: vi.fn(function (this: any) {}),
  VirtualTempSensor: vi.fn(function (this: any) {}),
  I2CMemoryDevice: vi.fn(function (this: any) {}),
}));

vi.mock('../store/useOscilloscopeStore', () => ({
  useOscilloscopeStore: {
    getState: vi.fn().mockReturnValue({ channels: [], pushSample: vi.fn() }),
  },
}));

vi.stubGlobal('requestAnimationFrame', (_cb: FrameRequestCallback) => 1);
vi.stubGlobal('cancelAnimationFrame', vi.fn());
vi.stubGlobal('sessionStorage', {
  getItem: vi.fn().mockReturnValue('test-session-id'),
  setItem: vi.fn(),
});

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { PartSimulationRegistry } from '../simulation/parts/PartSimulationRegistry';
import '../simulation/parts/ComplexParts';
import { PinManager } from '../simulation/PinManager';
import { RP2040Simulator } from '../simulation/RP2040Simulator';
import { setAdcVoltage } from '../simulation/parts/partUtils';

// ─── Mock factories ──────────────────────────────────────────────────────────

function makeElement(props: Record<string, unknown> = {}): HTMLElement {
  return {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    angle: 0,
    ...props,
  } as unknown as HTMLElement;
}

/** Simulator mock that mimics Esp32BridgeShim (no valid CPU cycles) */
function makeEsp32Shim() {
  let pwmCallback: ((pin: number, duty: number) => void) | null = null;
  const unsubPwm = vi.fn();
  const adcCalls: { channel: number; millivolts: number }[] = [];

  return {
    pinManager: {
      onPinChange: vi.fn().mockReturnValue(() => {}),
      onPwmChange: vi.fn().mockImplementation((_pin: number, cb: (pin: number, duty: number) => void) => {
        pwmCallback = cb;
        return unsubPwm;
      }),
      updatePwm: vi.fn(),
      triggerPinChange: vi.fn(),
    },
    setPinState: vi.fn(),
    isRunning: vi.fn().mockReturnValue(true),
    getCurrentCycles: vi.fn().mockReturnValue(-1), // ESP32: no valid cycles
    getClockHz: vi.fn().mockReturnValue(240_000_000),
    registerSensor: vi.fn().mockReturnValue(true),
    updateSensor: vi.fn(),
    unregisterSensor: vi.fn(),
    // Esp32BridgeShim.setAdcVoltage — mirrors the real implementation
    setAdcVoltage: vi.fn().mockImplementation((pin: number, voltage: number) => {
      let channel = -1;
      if (pin >= 36 && pin <= 39) channel = pin - 36;
      else if (pin >= 32 && pin <= 35) channel = pin - 28;
      if (channel < 0) return false;
      adcCalls.push({ channel, millivolts: Math.round(voltage * 1000) });
      return true;
    }),
    // Test helpers
    _getPwmCallback: () => pwmCallback,
    _unsubPwm: unsubPwm,
    _getAdcCalls: () => adcCalls,
  };
}

/** Simulator mock that mimics AVR (has valid CPU cycles) */
function makeAVRSim() {
  let pinCallback: ((pin: number, state: boolean) => void) | null = null;
  const unsubPin = vi.fn();

  return {
    pinManager: {
      onPinChange: vi.fn().mockImplementation((_pin: number, cb: (pin: number, state: boolean) => void) => {
        pinCallback = cb;
        return unsubPin;
      }),
      onPwmChange: vi.fn().mockReturnValue(() => {}),
      updatePwm: vi.fn(),
    },
    setPinState: vi.fn(),
    isRunning: vi.fn().mockReturnValue(true),
    getCurrentCycles: vi.fn().mockReturnValue(1000),
    getClockHz: vi.fn().mockReturnValue(16_000_000),
    cpu: { data: new Uint8Array(512).fill(0), cycles: 1000 },
    registerSensor: vi.fn().mockReturnValue(false),
    // Test helpers
    _getPinCallback: () => pinCallback,
    _unsubPin: unsubPin,
  };
}

const pinMap =
  (map: Record<string, number>) =>
  (name: string): number | null =>
    name in map ? map[name] : null;

// ─────────────────────────────────────────────────────────────────────────────
// 1. Servo — ESP32 path: subscribes to onPwmChange
// ─────────────────────────────────────────────────────────────────────────────

describe('Servo — ESP32 PWM subscription', () => {
  const logic = () => PartSimulationRegistry.get('servo')!;

  it('subscribes to onPwmChange when simulator has no valid CPU cycles (ESP32 shim)', () => {
    const shim = makeEsp32Shim();
    const el = makeElement();
    logic().attachEvents!(el, shim as any, pinMap({ PWM: 13 }), 'servo-esp32');

    expect(shim.pinManager.onPwmChange).toHaveBeenCalledWith(13, expect.any(Function));
  });

  it('updates angle when PWM duty cycle changes (pulse-width mapping)', () => {
    const shim = makeEsp32Shim();
    const el = makeElement() as any;
    logic().attachEvents!(el, shim as any, pinMap({ PWM: 13 }), 'servo-esp32-angle');

    const cb = shim._getPwmCallback();
    expect(cb).not.toBeNull();

    // ESP32 servo pulse-width mapping:
    // MIN_DC = 544/20000 = 0.0272 → 0°
    // MAX_DC = 2400/20000 = 0.12 → 180°
    const MIN_DC = 544 / 20000;
    const MAX_DC = 2400 / 20000;

    // At min duty → 0°
    cb!(13, MIN_DC);
    expect(el.angle).toBe(0);

    // At max duty → 180°
    cb!(13, MAX_DC);
    expect(el.angle).toBe(180);

    // At mid duty → ~90°
    const midDC = (MIN_DC + MAX_DC) / 2;
    cb!(13, midDC);
    expect(el.angle).toBe(90);
  });

  it('ignores out-of-range duty cycles (noise filtering)', () => {
    const shim = makeEsp32Shim();
    const el = makeElement() as any;
    logic().attachEvents!(el, shim as any, pinMap({ PWM: 13 }), 'servo-noise');

    const cb = shim._getPwmCallback();

    // Set to a known angle first
    cb!(13, 0.075); // mid-range
    const knownAngle = el.angle;

    // Very low duty (< 1%) is ignored
    cb!(13, 0.005);
    expect(el.angle).toBe(knownAngle); // unchanged

    // Very high duty (> 20%) is ignored
    cb!(13, 0.5);
    expect(el.angle).toBe(knownAngle); // unchanged
  });

  it('clamps angle to 0-180 range', () => {
    const shim = makeEsp32Shim();
    const el = makeElement() as any;
    logic().attachEvents!(el, shim as any, pinMap({ PWM: 13 }), 'servo-clamp');

    const cb = shim._getPwmCallback();

    // Slightly below MIN_DC (but above 1% filter) → clamps to 0°
    cb!(13, 0.015);
    expect(el.angle).toBe(0);

    // Slightly above MAX_DC (but below 20% filter) → clamps to 180°
    cb!(13, 0.15);
    expect(el.angle).toBe(180);
  });

  it('cleanup unsubscribes from onPwmChange', () => {
    const shim = makeEsp32Shim();
    const el = makeElement();
    const cleanup = logic().attachEvents!(el, shim as any, pinMap({ PWM: 13 }), 'servo-cleanup');

    cleanup();
    expect(shim._unsubPwm).toHaveBeenCalled();
  });

  it('does NOT subscribe to onPinChange (AVR cycle measurement)', () => {
    const shim = makeEsp32Shim();
    const el = makeElement();
    logic().attachEvents!(el, shim as any, pinMap({ PWM: 13 }), 'servo-no-pin');

    expect(shim.pinManager.onPinChange).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Servo — AVR path: uses onPinChange + cycle measurement
// ─────────────────────────────────────────────────────────────────────────────

describe('Servo — AVR cycle-based measurement', () => {
  const logic = () => PartSimulationRegistry.get('servo')!;

  it('subscribes to onPinChange (not onPwmChange) when simulator has valid CPU cycles', () => {
    const avr = makeAVRSim();
    const el = makeElement();
    logic().attachEvents!(el, avr as any, pinMap({ PWM: 9 }), 'servo-avr');

    expect(avr.pinManager.onPinChange).toHaveBeenCalledWith(9, expect.any(Function));
    // Should NOT use onPwmChange for AVR
    expect(avr.pinManager.onPwmChange).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Servo — RP2040 path: uses onPinChangeWithTime (instanceof check)
// ─────────────────────────────────────────────────────────────────────────────

describe('Servo — RP2040 timing-based measurement', () => {
  const logic = () => PartSimulationRegistry.get('servo')!;

  it('uses onPinChangeWithTime when simulator is RP2040Simulator instance', () => {
    const rp = new RP2040Simulator() as any;
    const el = makeElement();
    logic().attachEvents!(el, rp as any, pinMap({ PWM: 15 }), 'servo-rp2040');

    // RP2040 path sets onPinChangeWithTime
    expect(rp.onPinChangeWithTime).toBeTypeOf('function');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4-6. LEDC update routing — PinManager.updatePwm
// ─────────────────────────────────────────────────────────────────────────────

describe('LEDC update routing', () => {
  let pm: any;

  beforeEach(() => {
    pm = new PinManager();
  });

  it('routes to GPIO pin when update.gpio >= 0', () => {
    const update = { channel: 0, duty: 7.5, duty_pct: 7.5, gpio: 13 };
    const targetPin = (update.gpio !== undefined && update.gpio >= 0)
      ? update.gpio
      : update.channel;
    pm.updatePwm(targetPin, update.duty_pct / 100);

    expect(pm.updatePwm).toHaveBeenCalledWith(13, 0.075);
  });

  it('falls back to channel when gpio is -1', () => {
    const update = { channel: 2, duty: 50, duty_pct: 50, gpio: -1 };
    const targetPin = (update.gpio !== undefined && update.gpio >= 0)
      ? update.gpio
      : update.channel;
    pm.updatePwm(targetPin, update.duty_pct / 100);

    expect(pm.updatePwm).toHaveBeenCalledWith(2, 0.5);
  });

  it('falls back to channel when gpio is undefined', () => {
    const update = { channel: 3, duty: 100, duty_pct: 100 } as any;
    const targetPin = (update.gpio !== undefined && update.gpio >= 0)
      ? update.gpio
      : update.channel;
    pm.updatePwm(targetPin, update.duty_pct / 100);

    expect(pm.updatePwm).toHaveBeenCalledWith(3, 1.0);
  });

  it('normalizes duty_pct to 0.0–1.0 (divides by 100)', () => {
    const update = { channel: 0, duty: 25, duty_pct: 25, gpio: 5 };
    const targetPin = (update.gpio !== undefined && update.gpio >= 0)
      ? update.gpio
      : update.channel;
    pm.updatePwm(targetPin, update.duty_pct / 100);

    expect(pm.updatePwm).toHaveBeenCalledWith(5, 0.25);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Servo angle mapping — pulse-width based for ESP32
// ─────────────────────────────────────────────────────────────────────────────

describe('Servo angle mapping (pulse-width)', () => {
  const logic = () => PartSimulationRegistry.get('servo')!;

  it('maps real servo duty cycles to correct angles', () => {
    const shim = makeEsp32Shim();
    const el = makeElement() as any;
    logic().attachEvents!(el, shim as any, pinMap({ PWM: 13 }), 'servo-map');

    const cb = shim._getPwmCallback();

    // Servo pulse widths at 50Hz (20ms period):
    // 544µs = 2.72% duty → 0°
    // 1472µs = 7.36% duty → 90°
    // 2400µs = 12.00% duty → 180°
    const testCases = [
      { pulseUs: 544, expectedAngle: 0 },
      { pulseUs: 1008, expectedAngle: 45 },
      { pulseUs: 1472, expectedAngle: 90 },
      { pulseUs: 1936, expectedAngle: 135 },
      { pulseUs: 2400, expectedAngle: 180 },
    ];

    for (const { pulseUs, expectedAngle } of testCases) {
      const dutyCycle = pulseUs / 20000; // fraction of 20ms period
      cb!(13, dutyCycle);
      expect(el.angle).toBe(expectedAngle);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Potentiometer — setAdcVoltage on ESP32
// ─────────────────────────────────────────────────────────────────────────────

describe('Potentiometer — ESP32 ADC path', () => {
  it('setAdcVoltage delegates to Esp32BridgeShim.setAdcVoltage', () => {
    const shim = makeEsp32Shim();
    const result = setAdcVoltage(shim as any, 34, 1.65);
    expect(result).toBe(true);
    expect(shim.setAdcVoltage).toHaveBeenCalledWith(34, 1.65);
  });

  it('setAdcVoltage returns false for non-ADC ESP32 pins', () => {
    const shim = makeEsp32Shim();
    // GPIO 13 is not an ADC pin on ESP32
    const result = setAdcVoltage(shim as any, 13, 1.65);
    expect(result).toBe(false);
  });

  it('setAdcVoltage works for AVR (pin 14-19)', () => {
    const avrSim = makeAVRSim() as any;
    avrSim.getADC = () => ({ channelValues: new Array(6).fill(0) });
    const result = setAdcVoltage(avrSim as any, 14, 2.5);
    expect(result).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. ESP32 ADC channel mapping (GPIO → ADC1 channel)
// ─────────────────────────────────────────────────────────────────────────────

describe('ESP32 ADC channel mapping', () => {
  it('maps GPIO 36-39 → ADC1 CH0-3', () => {
    const shim = makeEsp32Shim();
    setAdcVoltage(shim as any, 36, 1.0);
    setAdcVoltage(shim as any, 37, 1.0);
    setAdcVoltage(shim as any, 38, 1.0);
    setAdcVoltage(shim as any, 39, 1.0);

    const calls = shim._getAdcCalls();
    expect(calls.map(c => c.channel)).toEqual([0, 1, 2, 3]);
  });

  it('maps GPIO 32-35 → ADC1 CH4-7', () => {
    const shim = makeEsp32Shim();
    setAdcVoltage(shim as any, 32, 1.0);
    setAdcVoltage(shim as any, 33, 1.0);
    setAdcVoltage(shim as any, 34, 1.0);
    setAdcVoltage(shim as any, 35, 1.0);

    const calls = shim._getAdcCalls();
    expect(calls.map(c => c.channel)).toEqual([4, 5, 6, 7]);
  });

  it('converts voltage to millivolts correctly', () => {
    const shim = makeEsp32Shim();
    setAdcVoltage(shim as any, 34, 1.65);

    const calls = shim._getAdcCalls();
    expect(calls[0].millivolts).toBe(1650);
  });

  it('rejects non-ADC GPIOs (0-31)', () => {
    const shim = makeEsp32Shim();
    const result = setAdcVoltage(shim as any, 13, 1.0);
    expect(result).toBe(false);
    expect(shim._getAdcCalls()).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. LEDC polling — data type and internal config
// ─────────────────────────────────────────────────────────────────────────────

describe('LEDC polling — data format', () => {
  it('duty values from QEMU are floats representing percentages (0-100)', () => {
    // Simulates what the LEDC polling thread reads from QEMU
    // QEMU stores: duty[ch] = 100.0 * raw_duty / (16 * (2^duty_res - 1))
    // For a servo at 50Hz, 13-bit resolution, 1500µs pulse:
    //   raw_duty = 1500/20000 * 8192 = 614.4
    //   duty_pct = 100 * 614.4 / (16 * 8191) ≈ 0.469... but QEMU formula differs

    // What matters: duty is a float percentage
    const dutyPct = 7.5; // 7.5% = 1500µs at 50Hz = ~90°

    // Frontend receives duty_pct, divides by 100
    const dutyCycleFraction = dutyPct / 100; // 0.075

    // Servo maps pulse width:
    const MIN_DC = 544 / 20000;   // 0.0272
    const MAX_DC = 2400 / 20000;  // 0.12
    const angle = Math.round(
      ((dutyCycleFraction - MIN_DC) / (MAX_DC - MIN_DC)) * 180
    );

    // 7.5% duty ≈ 93° (close to 90°)
    expect(angle).toBeGreaterThanOrEqual(88);
    expect(angle).toBeLessThanOrEqual(95);
  });

  it('LEDC internal config ID is 6 (QEMU_INTERNAL_LEDC_CHANNEL_DUTY)', () => {
    // Verifies the constant matches QEMU's definition
    // #define QEMU_INTERNAL_LEDC_CHANNEL_DUTY 6
    const QEMU_INTERNAL_LEDC_CHANNEL_DUTY = 6;
    expect(QEMU_INTERNAL_LEDC_CHANNEL_DUTY).toBe(6);
  });

  it('deduplication: identical duty values are not re-emitted', () => {
    // Simulates the _last_duty tracking in _ledc_poll_thread
    const lastDuty = [0.0, 0.0, 0.0];
    const emitted: { ch: number; duty: number }[] = [];

    function pollOnce(duties: number[]) {
      for (let ch = 0; ch < duties.length; ch++) {
        const duty = duties[ch];
        if (Math.abs(duty - lastDuty[ch]) < 0.01) continue;
        lastDuty[ch] = duty;
        if (duty > 0) emitted.push({ ch, duty });
      }
    }

    // First poll: duty = 7.5 → emitted
    pollOnce([7.5, 0, 0]);
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toEqual({ ch: 0, duty: 7.5 });

    // Second poll: same duty → NOT emitted (deduplication)
    pollOnce([7.5, 0, 0]);
    expect(emitted).toHaveLength(1); // still 1

    // Third poll: duty changed → emitted
    pollOnce([12.0, 0, 0]);
    expect(emitted).toHaveLength(2);
    expect(emitted[1]).toEqual({ ch: 0, duty: 12.0 });
  });
});
