/**
 * Pre-built example chips shipped with Velxio. Sources live in `examples/`
 * and are loaded at build time via Vite's `?raw` query so they end up as
 * inline string constants in the bundle.
 *
 * The .c sources are the canonical implementations validated by the
 * sandbox at `test/test_custom_chips/`.
 */

// .c sources
import inverterC      from './examples/inverter.c?raw';
import xorC           from './examples/xor.c?raw';
import cd4094C        from './examples/cd4094.c?raw';
import eeprom24c01C   from './examples/eeprom-24c01.c?raw';
import eeprom24lc256C from './examples/eeprom-24lc256.c?raw';
import uartRot13C     from './examples/uart-rot13.c?raw';
import sn74hc595C     from './examples/sn74hc595.c?raw';
import mcp3008C       from './examples/mcp3008.c?raw';
import pcf8574C       from './examples/pcf8574.c?raw';
import ds3231C        from './examples/ds3231.c?raw';
import pulseCounterC  from './examples/pulse-counter.c?raw';

// .chip.json sources
import inverterJ      from './examples/inverter.chip.json?raw';
import xorJ           from './examples/xor.chip.json?raw';
import cd4094J        from './examples/cd4094.chip.json?raw';
import eeprom24c01J   from './examples/eeprom-24c01.chip.json?raw';
import eeprom24lc256J from './examples/eeprom-24lc256.chip.json?raw';
import uartRot13J     from './examples/uart-rot13.chip.json?raw';
import sn74hc595J     from './examples/sn74hc595.chip.json?raw';
import mcp3008J       from './examples/mcp3008.chip.json?raw';
import pcf8574J       from './examples/pcf8574.chip.json?raw';
import ds3231J        from './examples/ds3231.chip.json?raw';
import pulseCounterJ  from './examples/pulse-counter.chip.json?raw';

export interface ChipExample {
  id: string;
  name: string;
  description: string;
  category: 'logic' | 'memory' | 'protocol' | 'analog' | 'utility';
  sourceC: string;
  chipJson: string;
}

export const CHIP_EXAMPLES: ChipExample[] = [
  {
    id: 'inverter',
    name: 'Inverter',
    description: 'OUT = !IN. The simplest possible chip — perfect first example.',
    category: 'logic',
    sourceC: inverterC,
    chipJson: inverterJ,
  },
  {
    id: 'xor',
    name: 'XOR Gate',
    description: '2-input exclusive-OR. OUT = A xor B.',
    category: 'logic',
    sourceC: xorC,
    chipJson: xorJ,
  },
  {
    id: 'cd4094',
    name: 'CD4094 Shift Register',
    description: '8-stage shift-and-store register. Serial in, parallel out, latch on STR.',
    category: 'logic',
    sourceC: cd4094C,
    chipJson: cd4094J,
  },
  {
    id: 'sn74hc595',
    name: '74HC595 SPI Shift Register',
    description: '8-bit serial-in parallel-out via SPI. Latch on RCLK rising edge.',
    category: 'logic',
    sourceC: sn74hc595C,
    chipJson: sn74hc595J,
  },
  {
    id: 'eeprom-24c01',
    name: '24C01 EEPROM (128 B)',
    description: 'I2C EEPROM at base address 0x50. 128 bytes, 8-bit addressing.',
    category: 'memory',
    sourceC: eeprom24c01C,
    chipJson: eeprom24c01J,
  },
  {
    id: 'eeprom-24lc256',
    name: '24LC256 EEPROM (32 KB)',
    description: 'I2C EEPROM at 0x50. 32 KB, 16-bit addressing, page writes.',
    category: 'memory',
    sourceC: eeprom24lc256C,
    chipJson: eeprom24lc256J,
  },
  {
    id: 'pcf8574',
    name: 'PCF8574 I/O Expander',
    description: 'I2C 8-bit I/O expander at base 0x20. Reads/writes 8 lines.',
    category: 'protocol',
    sourceC: pcf8574C,
    chipJson: pcf8574J,
  },
  {
    id: 'ds3231',
    name: 'DS3231 RTC',
    description: 'I2C real-time clock at 0x68. 19 registers, BCD-encoded.',
    category: 'protocol',
    sourceC: ds3231C,
    chipJson: ds3231J,
  },
  {
    id: 'mcp3008',
    name: 'MCP3008 SPI ADC',
    description: '8-channel 10-bit ADC over SPI. Reads 0–5V analog inputs.',
    category: 'analog',
    sourceC: mcp3008C,
    chipJson: mcp3008J,
  },
  {
    id: 'uart-rot13',
    name: 'ROT13 UART',
    description: 'UART loopback that ROT13-shifts every received byte.',
    category: 'protocol',
    sourceC: uartRot13C,
    chipJson: uartRot13J,
  },
  {
    id: 'pulse-counter',
    name: 'Pulse Counter',
    description: 'Counts rising edges on PULSE. Toggles OVF every N pulses (configurable).',
    category: 'utility',
    sourceC: pulseCounterC,
    chipJson: pulseCounterJ,
  },
];

export function findExample(id: string): ChipExample | undefined {
  return CHIP_EXAMPLES.find((e) => e.id === id);
}

export const BLANK_CHIP: ChipExample = {
  id: 'blank',
  name: 'Blank',
  description: 'Start from scratch.',
  category: 'utility',
  sourceC: `#include "velxio-chip.h"
#include <stdlib.h>

typedef struct {
  vx_pin in;
  vx_pin out;
} chip_state_t;

static void on_in_change(void *ud, vx_pin pin, int value) {
  chip_state_t *s = (chip_state_t*)ud;
  vx_pin_write(s->out, value);
}

void chip_setup(void) {
  chip_state_t *s = (chip_state_t*)malloc(sizeof(chip_state_t));
  s->in  = vx_pin_register("IN",  VX_INPUT);
  s->out = vx_pin_register("OUT", VX_OUTPUT);
  vx_pin_watch(s->in, VX_EDGE_BOTH, on_in_change, s);
  vx_log("blank chip ready");
}
`,
  chipJson: `{
  "schema": "velxio-chip/v1",
  "name": "My Chip",
  "author": "",
  "license": "MIT",
  "description": "",
  "pins": ["IN", "OUT", "GND", "VCC"],
  "attributes": []
}
`,
};
