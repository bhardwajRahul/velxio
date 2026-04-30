# Complete Emulation Plan — Phases A-G

This document is the master plan for taking the test_intel chip suite
from "baseline silicon contracts validated" to "real-software emulation
that runs CP/M, ZEXDOC, CPUDIAG, Busicom 141-PF, and DOS-era 8086
programs". It is updated as each phase completes; the sentinel at the
top of each phase reflects status.

## Constraints

- **No frontend or backend modifications.** Velxio core stays
  untouched; all work happens under `test/test_intel/`.
- **Clean-room implementation.** No GPL code. Permissive references
  (MIT/BSD/zlib/Apache) only, used for cross-validation never copying.
- **Test-first.** Every chip / feature gets a test before any
  permanent .c change.
- **Internet research authorized.** Download datasheets, public-domain
  ROMs, permissive open-source emulators as references.
- **Document each phase on completion.** Append a "Phase X completed"
  section below with: what was done, what was deferred, lessons
  learned, test count delta.

## Phases at a glance

| Phase | Scope | Effort | Status |
| --- | --- | --- | --- |
| **A** | 8080 INTA bus cycle | low | ✅ done 2026-04-30 |
| **B** | Z80 ISA polish for ZEXDOC | high | ⏸️ pending |
| **C** | Support chip ecosystem (4001, 4002, 8259, 8253, 8255, 8251, rom-1m) | high | ⏸️ pending |
| **D** | 4004/4040 I/O completion (uses chips from C) | medium | ⏸️ pending |
| **E** | 8086 ISA completion | high | ⏸️ pending |
| **F** | Real software validation (CPUDIAG, ZEXDOC, Busicom, 8088 V2) | medium | ⏸️ pending |
| **G** | Cycle accuracy (optional) | high | ⏸️ deferred |

---

## Phase A — 8080 INTA bus protocol

### Goal
Replace the current "synthesize RST 7 internally" hack in `8080.c`
with a proper INT-acknowledge bus cycle. When the chip detects INT
asserted (with IME=1), it should perform an INTA M1 cycle (status byte
0x23), read the opcode from the data bus, and execute it. External
hardware (an 8259 PIC, or a test fixture) drives the RST opcode onto
the data bus during INTA.

### Deliverables
- Modify `test_8080/8080.c`: replace `if (G.int_pending && G.ime)` block
  with a real bus-cycle that emits ST_INTA and reads the data bus.
- Test: drive INT high, drive RST 5 (0xEF) on the bus during INTA,
  observe PC = 0x0028 + observe ISR runs.
- Update `test_8080/README.md` status.

### Sources
- [I8080-1975] User's Manual section on Interrupt Acknowledge
- Cross-check against `superzazu/8080`'s INTA implementation

---

## Phase B — Z80 ISA polish for ZEXDOC

### Goal
Bring the Z80 chip from "passes our 11 active tests" to "passes
ZEXDOC" (the documented-flags subset of Frank Cringle's ZEXALL test
ROM). This requires implementing several features that real Z80
software depends on but which our current chip stubs.

### Sub-phases
- **B.1** CB prefix (256 ops): BIT n,r / SET n,r / RES n,r and the
  rotates RLC/RRC/RL/RR/SLA/SRA/SLL/SRL on r ∈ B/C/D/E/H/L/(HL)/A.
- **B.2** DDCB / FDCB indexed bit ops: e.g. `BIT 0, (IX+d)` — fetched
  as `DD CB d byteOpcode`.
- **B.3** Undocumented X (bit 3) and Y (bit 5) flag bits — copies of
  result bits 3/5. ZEXALL fails without these. Apply to all
  flag-affecting instructions.
- **B.4** MEMPTR (WZ) internal register — affects bits 3/5 of F after
  `BIT n,(HL)` and DD/FD-prefixed BIT. Update list per Sean Young §4.1.
- **B.5** Z80-specific DAA — uses N flag to determine direction
  (additive vs subtractive); H-flag table per Sean Young §4.7.
- **B.6** Block I/O exact flags (INI/IND/INIR/INDR/OUTI/OUTD/OTIR/OTDR)
  per Sean Young §4.3.
- **B.7** CPI/CPD/CPIR/CPDR with H/PV/Z exactly per Sean Young §4.2.
- **B.8** RLD/RRD instructions.
- **B.9** 16-bit ADC HL,rr / SBC HL,rr with bit-12 half-carry +
  16-bit overflow flag.
- **B.10** All 8 NEG aliases (ED 44/4C/54/5C/64/6C/74/7C).

### Deliverables
- ~600 LOC additions to `test_z80/z80.c`.
- New tests under `test_z80/`: per-feature unit tests + ZEXDOC
  integration test (runs the 9 KB ROM to completion, verifies the
  printed result byte sequence).
- Vendoring of ZEXDOC ROM (public domain, Frank Cringle 1994).

### Sources
- Sean Young, *The Undocumented Z80 Documented* v0.91 (in `pdfs/`)
- Zilog UM008003-1202 (in `pdfs/`)
- Cross-check: `floooh/chips/z80.h` for MEMPTR map

---

## Phase C — Support chip ecosystem

### Goal
Build the supporting chips that real systems used. Without these,
none of our CPUs can run actual programs on the canvas. All chips
follow the existing custom-chip API and have unit tests.

### Sub-phases
- **C.1** `4001` ROM (16-pin DIP, 256 bytes, 4-bit nibble bus matching
  4004 SRC protocol; CMROM-strobed; ROM image baked in like rom-32k)
- **C.2** `4002` RAM (16-pin DIP, 80 nibbles + 4 output port lines,
  SRC-addressed, CMRAM-strobed)
- **C.3** `8259` PIC — 28-pin, 8 IRQ inputs, INT/INTA cycle to CPU,
  programmable vector base. Used by 8080/Z80/8086 for real interrupt
  systems.
- **C.4** `8253` PIT — 24-pin, 3 channels of 16-bit countdown timers.
  Essential for BIOS-style code (system tick, speaker frequency).
- **C.5** `8255` PPI — 40-pin, three 8-bit ports (A, B, C), 4 modes.
  Generic peripheral interface used in many 8080/Z80/8086 systems.
- **C.6** `8251` USART — 28-pin, async serial UART. Enables "hello
  world" via terminal emulation.
- **C.7** `rom-1m` — variant of rom-32k with 20-bit address bus
  (A0..A19) so 8086 can fetch from CS:IP=0xFFFF0 on canvas.

### Deliverables
- ~1500 LOC across 7 chips.
- Per-chip test file (pin contract + protocol behavior).
- Per-chip README.md.
- Updated `test_buses/README.md` chip table.

### Sources
- Each chip's Intel datasheet (download from bitsavers.org).

---

## Phase D — 4004/4040 I/O completion

### Goal
Wire up the I/O group instructions (WRM/RDM/ADM/SBM/WRR/RDR/WR0..3/
RD0..3) so they actually access RAM/ROM ports through the SRC + CMRAM
mechanism. Requires `4001` and `4002` from Phase C.

### Sub-phases
- **D.1** SRC instruction emits chip-select address on D bus during X2
  with appropriate CMROM/CMRAMᵢ strobing, latched by external chip
- **D.2** Subsequent I/O instruction (WRM/RDM/etc.) re-asserts the
  selected CMROM/CMRAMᵢ during M2 + X2/X3 to drive R/W to that chip
- **D.3** WRM/RDM/ADM/SBM hit 4002 RAM character cells
- **D.4** WRR/RDR hit 4001 ROM I/O port lines
- **D.5** WR0..WR3 / RD0..RD3 hit 4002 RAM status characters
- **D.6** 4040's BBS reissues the saved SRC at the X2/X3 of the BBS
  cycle so the chip selected before the interrupt is re-armed

### Deliverables
- Updates to `test_4004/4004.c` and `test_4040/4040.c`.
- Integration tests using `4001` + `4002` chips on the same board:
  4004 reads/writes RAM, drives output port, reads input port.

### Sources
- MCS-4 manual §III.B (in `pdfs/`)
- MCS-40 manual §1 (in `pdfs/`)

---

## Phase E — 8086 ISA completion

### Goal
Bring the 8086 from ~50 opcodes (~30% of ISA) to substantially
complete (~95%). Target: subset of 8088 V2 SingleStepTests passing.

### Sub-phases
- **E.1** Shifts and rotates: SHL/SHR/SAR/ROL/ROR/RCL/RCR with imm or
  CL count. Group 2 (0xD0..0xD3).
- **E.2** String ops: MOVSB/MOVSW, CMPSB/CMPSW, SCASB/SCASW, LODSB/
  LODSW, STOSB/STOSW + REP/REPE/REPNE prefix handling.
- **E.3** Multiplication / division: MUL r/m8, MUL r/m16, IMUL r/m8,
  IMUL r/m16, DIV r/m8, DIV r/m16, IDIV r/m8, IDIV r/m16. Group 3
  (0xF6/0xF7).
- **E.4** BCD adjust: DAA, DAS, AAA, AAS, AAM imm8, AAD imm8.
- **E.5** Port I/O: IN AL,imm8 / IN AX,imm8 / IN AL,DX / IN AX,DX
  + OUT counterparts.
- **E.6** Hardware interrupts: NMI vector 2, INTR + INTA cycle reading
  vector byte from data bus, INT imm8, INT 3, INTO, IRET.
- **E.7** LDS/LES (load far pointer), LAHF/SAHF, XCHG, XLAT.
- **E.8** Conditional flag-set: SAHF, LAHF.
- **E.9** Group 4 (0xFE) — INC/DEC r/m8.
- **E.10** Undocumented opcodes: POP CS (0x0F), SALC (0xD6).

### Deliverables
- ~800 LOC additions to `test_8086/8086.c`.
- New tests under `test_8086/` for each instruction class.

### Sources
- Intel iAPX 86,88 User's Manual (in `pdfs/`)
- Cross-check: 8086tiny, MartyPC

---

## Phase F — Real software validation

### Goal
Prove correctness by running historic public-domain test programs.

### Sub-phases
- **F.1** **CPUDIAG** on 8080: load Microcosm Associates CPU diagnostic
  (1980, public domain) + minimal CP/M-like BDOS jump table; run until
  it prints "CPU IS OPERATIONAL"; integration test asserts expected
  output sequence.
- **F.2** **ZEXDOC** on Z80: load Frank Cringle's ZEXDOC (subset of
  ZEXALL — documented flags only); run for ~minutes of simulated time
  (it's a many-CRC test); assert all 67 sub-tests pass.
- **F.3** **8088 V2 SingleStepTests subset** on 8086: load JSON test
  cases (initial state + bus trace + final state) for selected
  opcodes; verify our chip matches.
- **F.4** **Busicom 141-PF** on 4004: load the original Busicom
  calculator firmware; verify display sequence for a known
  calculation. (Requires 4001/4002 chips from Phase C.)

### Deliverables
- Integration test files under `test_<chip>/` that wire the CPU + ROM
  + RAM and run the test ROM to completion.
- Vendored public-domain ROMs under `test/test_intel/roms/`:
  - `cpudiag.bin` (~2 KB)
  - `zexdoc.bin` (~9 KB)
  - `busicom_141pf.bin` (~1 KB)
- Test result expectations documented in autosearch/.

### Sources
- CPUDIAG: widely mirrored on Altair-related sites; license is
  effectively public-domain (Microcosm Associates, 1980).
- ZEXDOC/ZEXALL: Frank Cringle 1994; public domain.
- Busicom firmware: Intel released to public domain in 2009.
- 8088 V2 SingleStepTests: Daniel Balsom's MartyPC project,
  MIT-licensed.

---

## Phase G — Cycle accuracy (optional, deferred)

### Goal
Move from instruction-per-tick to cycle-accurate timing. Necessary
for emulating cycle-counting retro games (Spectrum games, Lotus
Esprit, etc.).

### Sub-phases
- **G.1** Per-opcode cycle counts for all 5 CPUs.
- **G.2** 8086 prefetch queue (4 bytes). Affects self-modifying
  code observable behavior.
- **G.3** Z80 contended memory model (Spectrum 16K..32K cycles).
- **G.4** Wait-state insertion via WAIT̅ + READY pin sampling.

This is HUGE work and only valuable for niche use-cases. Skipped
until user asks for it.

---

## Documentation conventions for completed phases

Each completed phase appends a section titled `## Phase X — completed
(YYYY-MM-DD)` with:

- **Delivered**: bullet list of what shipped
- **Deferred**: bullet list of what was originally planned but moved
  out of scope
- **Tests delta**: +N passing, +M todo, etc.
- **Files touched**: key paths
- **Lessons / surprises**: notable discoveries during implementation
- **Sources cited**: PDFs / repos / docs actually consulted

Commits made during the phase reference the phase letter in the
subject line (e.g. "test_intel: phase A — 8080 INTA bus protocol").

---

## Phase A — completed (2026-04-30)

### Delivered
- `test_8080/8080.c`: replaced the synthesised-RST-7 stub with a real
  INTA bus cycle. When `int_pending && ime`, the chip clears IME +
  INTE pin, runs `bus_read(PC, ST_INTA)` to emit status byte 0x23
  (M1+INTA+WO̅) on the data bus during T1, then samples the opcode
  external hardware (e.g. an 8259 PIC) jams onto D0..D7 during DBIN.
  RST n opcodes (0xC7..0xFF, mask 0xC7==0xC7) are decoded and
  push+vector executed.
- `test_8080/8080.test.js`: rewrote the INT test to install a
  test-fixture INTA driver that snoops SYNC + the status byte to
  detect INTA cycles, then drives RST 5 (0xEF) on the data bus during
  DBIN. Driver registered AFTER bootCpu's fake_rom so the late drive
  overrides the fake_rom's program-byte drive.

### Deferred
- Multi-byte opcodes during INTA (CALL nnn, JMP nnn) — would require
  the chip to issue further INTA cycles for operand bytes. Spec
  permits but rarely used in practice. The chip currently treats
  non-RST INTA opcodes as NOP.
- EI delayed-effect: real 8080 enables INT acknowledge on the
  *instruction after* EI so `EI; RET` is atomic. Mine enables
  immediately. Minor fidelity gap, no current test exercises it.

### Tests delta
- `test_8080`: 17 passing → **18 passing** (+1, the INT test
  promoted from pending-broken to passing).
- Total `test_intel`: 63 → **64 passing**, 16 todo.

### Files touched
- `test/test_intel/test_8080/8080.c`
- `test/test_intel/test_8080/8080.test.js`

### Lessons
- Listener registration order matters when multiple listeners drive
  the same pin. fake_rom registers a DBIN listener; an INTA fixture
  must register its own DBIN listener LATER so the late drive
  overrides. Documented in test comments.
- Two-stage SYNC→DBIN handoff (latch a flag at SYNC, act on DBIN)
  works cleanly; the alternative of doing everything in the SYNC
  callback fails because fake_rom's later DBIN drive wins.

### Sources cited
- `pdfs/mcs80_users.pdf` (Intel 1975) — INTA cycle status word + bus
  protocol
- Cross-checked behavior against `superzazu/8080`'s `i8080.c` lines
  on its `interrupt()` function (no code copied).

---

## Phase B — Z80 ISA polish for ZEXDOC — STARTING

(Updates appended as work proceeds.)
