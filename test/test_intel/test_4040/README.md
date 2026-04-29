# test_4040 — Intel 4040 as a velxio custom chip

See [../autosearch/02_intel_chips_overview.md](../autosearch/02_intel_chips_overview.md#intel-4040-1974)
for the spec.

## Status

📋 **Spec only.** Will reuse the 4004 emulator core once that's
working.

## Pin contract (24-pin DIP, real silicon)

The 4040 is a 4004 superset; it keeps every 4004 signal and adds:

- `INT` (interrupt request, in)
- `STOP` (single-step, in)
- `STOP ACK` (out)
- Additional bank-select / index-pointer lines

**Action item:** pull the exact 4040 pinout from a datasheet and fill
in this table before writing `.chip.json`. Pin order matters for the
on-canvas drag-and-drop appearance.

| Pin | Name      | Dir   | Notes |
| --- | --------- | ----- | ----- |
|     | D0..D3    | I/O   | Same multiplexed nibble bus as 4004 |
|     | CLK1, CLK2| in    | |
|     | SYNC      | out   | |
|     | RESET     | in    | |
|     | TEST      | in    | |
|     | CM-ROM0..1| out   | 4040 has *two* ROM strobes (4004 has one) |
|     | CM-RAM0..3| out   | |
|     | INT       | in    | New on 4040 |
|     | STOP      | in    | New on 4040 |
|     | STOP ACK  | out   | New on 4040 |
|     | VDD, VSS  | power | |

## Implementation plan

1. Land the 4004 first.
2. Fork its `.c` source into `4040.c`.
3. Extend the register file from 16 → 24 4-bit registers.
4. Extend the PC stack from 3-deep → 7-deep.
5. Add the new opcodes (interrupt enable/disable, return-from-interrupt,
   stop, the extra register-pair operations).
6. Add `INT` pin watch. On rising edge, push PC and vector to fixed
   address `[verify from datasheet]`.
7. Add `STOP` pin watch. On rising edge, freeze the cycle timer and
   assert `STOP ACK`.

## Target demo sketch

Same as 4004 (LED blink), then a second sketch that uses `INT` —
an external "button" chip drives `INT`, the 4040's ISR toggles a
different output. Demonstrates the only feature that matters versus
the 4004.

## Files to create later

- `4040.chip.json`
- `4040.c`
- `sketch_blink.asm`
- `sketch_irq.asm`
