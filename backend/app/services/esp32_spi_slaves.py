"""ESP32 SPI slave state machines — runs inside the worker subprocess
synchronously, alongside the existing I2C slaves in
``esp32_i2c_slaves.py``.

The first inhabitant is the SSD168x ePaper decoder. It mirrors the
reference implementation in
``test/test_epaper/ssd168x_decoder.py`` byte-for-byte (same field
names, same algorithm) so the cross-decoder consistency test can
replay the same fixtures through both implementations.

Velxio's ``esp32_worker.py`` instantiates one ``Ssd168xEpaperSlave``
per ePaper component on the canvas, hooks the DC/CS/RST GPIO
``_on_pin_change`` callback to track those pins, and feeds every SPI
byte (op == 0x00 from the picsimlab dispatch) into ``feed()``. On
``MASTER_ACTIVATION`` (0x20) the slave invokes ``on_flush(frame)``;
the worker base64-encodes that frame and pushes it to the frontend
as an ``epaper_update`` WebSocket event for real-time rendering.
"""
from __future__ import annotations

import base64
from dataclasses import dataclass, field
from typing import Callable, List, Optional


# ── Command opcodes (SSD1681; SSD1675/1680/1683 share these) ─────────────────

CMD_DRIVER_OUTPUT_CTRL = 0x01
CMD_GATE_DRIVING_VOLTAGE = 0x03
CMD_SOURCE_DRIVING_VOLT = 0x04
CMD_DEEP_SLEEP = 0x10
CMD_DATA_ENTRY_MODE = 0x11
CMD_SW_RESET = 0x12
CMD_TEMP_SENSOR = 0x18
CMD_MASTER_ACTIVATION = 0x20
CMD_DISP_UPDATE_CTRL_1 = 0x21
CMD_DISP_UPDATE_CTRL_2 = 0x22
CMD_WRITE_BLACK_VRAM = 0x24
CMD_WRITE_RED_VRAM = 0x26
CMD_WRITE_VCOM_REG = 0x2C
CMD_WRITE_LUT = 0x32
CMD_BORDER_WAVEFORM = 0x3C
CMD_END_OPTION = 0x3F
CMD_SET_RAMX_RANGE = 0x44
CMD_SET_RAMY_RANGE = 0x45
CMD_SET_RAMX_COUNTER = 0x4E
CMD_SET_RAMY_COUNTER = 0x4F


@dataclass
class Frame:
    """Composed B/W (and optionally red) frame ready to ship to the frontend."""
    width: int
    height: int
    pixels: bytes  # length == width * height; values 0=black, 1=white, 2=red


@dataclass
class Ssd168xEpaperSlave:
    """Stateful SSD168x SPI peripheral. Algorithm verbatim with the Python
    reference in ``test/test_epaper/ssd168x_decoder.py``."""

    component_id: str
    width: int
    height: int
    on_flush: Optional[Callable[[Frame], None]] = None

    bw_ram: bytearray = field(init=False)
    red_ram: bytearray = field(init=False)
    _current_cmd: int = -1
    _params: List[int] = field(default_factory=list)
    _ram_target: str = "bw"
    _x_byte: int = 0
    _y: int = 0
    _xrange: tuple = (0, 0)
    _yrange: tuple = (0, 0)
    _entry_mode: int = 0x03
    refreshed_count: int = 0
    unknown_cmds: List[int] = field(default_factory=list)
    in_deep_sleep: bool = False

    def __post_init__(self) -> None:
        bytes_per_row = (self.width + 7) // 8
        self.bw_ram = bytearray([0xFF] * (bytes_per_row * self.height))
        self.red_ram = bytearray([0x00] * (bytes_per_row * self.height))
        self._xrange = (0, bytes_per_row - 1)
        self._yrange = (0, self.height - 1)

    # ── Public API ─────────────────────────────────────────────────────

    def feed(self, byte: int, dc_high: bool) -> None:
        """Process one SPI byte. ``dc_high`` mirrors the DC pin (False = command)."""
        if not dc_high:
            self._begin_command(byte & 0xFF)
        else:
            self._handle_data(byte & 0xFF)

    def reset(self) -> None:
        bytes_per_row = (self.width + 7) // 8
        self.bw_ram = bytearray([0xFF] * (bytes_per_row * self.height))
        self.red_ram = bytearray([0x00] * (bytes_per_row * self.height))
        self._current_cmd = -1
        self._params = []
        self._ram_target = "bw"
        self._x_byte = 0
        self._y = 0
        self.in_deep_sleep = False

    def compose_frame(self) -> Frame:
        bytes_per_row = (self.width + 7) // 8
        pixels = bytearray(self.width * self.height)
        for y in range(self.height):
            for xb in range(bytes_per_row):
                b_byte = self.bw_ram[y * bytes_per_row + xb]
                r_byte = self.red_ram[y * bytes_per_row + xb]
                for bit in range(8):
                    x = xb * 8 + bit
                    if x >= self.width:
                        break
                    mask = 0x80 >> bit
                    is_red = bool(r_byte & mask)
                    is_white = bool(b_byte & mask)
                    pixels[y * self.width + x] = 2 if is_red else (1 if is_white else 0)
        return Frame(self.width, self.height, bytes(pixels))

    def compose_frame_b64(self) -> str:
        """Convenience for the worker — same as compose_frame() but base64-encoded."""
        return base64.b64encode(self.compose_frame().pixels).decode("ascii")

    # ── Internal: command / data dispatch ──────────────────────────────

    def _begin_command(self, cmd: int) -> None:
        self._current_cmd = cmd
        self._params = []

        if cmd == CMD_SW_RESET:
            self.reset()
            return
        if cmd == CMD_MASTER_ACTIVATION:
            self.refreshed_count += 1
            frame = self.compose_frame()
            if self.on_flush:
                try:
                    self.on_flush(frame)
                except Exception:
                    # Never let the frontend hook raise back into QEMU thread.
                    pass
            return
        if cmd == CMD_WRITE_BLACK_VRAM:
            self._ram_target = "bw"
            return
        if cmd == CMD_WRITE_RED_VRAM:
            self._ram_target = "red"
            return
        if cmd in (
            CMD_DRIVER_OUTPUT_CTRL, CMD_GATE_DRIVING_VOLTAGE,
            CMD_SOURCE_DRIVING_VOLT, CMD_DEEP_SLEEP, CMD_DATA_ENTRY_MODE,
            CMD_TEMP_SENSOR, CMD_DISP_UPDATE_CTRL_1, CMD_DISP_UPDATE_CTRL_2,
            CMD_WRITE_VCOM_REG, CMD_WRITE_LUT, CMD_BORDER_WAVEFORM,
            CMD_END_OPTION, CMD_SET_RAMX_RANGE, CMD_SET_RAMY_RANGE,
            CMD_SET_RAMX_COUNTER, CMD_SET_RAMY_COUNTER,
        ):
            return
        self.unknown_cmds.append(cmd)

    def _handle_data(self, byte: int) -> None:
        cmd = self._current_cmd
        params = self._params
        params.append(byte)

        if cmd == CMD_DEEP_SLEEP and len(params) == 1:
            self.in_deep_sleep = byte != 0
        elif cmd == CMD_DATA_ENTRY_MODE and len(params) == 1:
            self._entry_mode = byte
        elif cmd == CMD_SET_RAMX_RANGE and len(params) == 2:
            self._xrange = (params[0], params[1])
            self._x_byte = params[0]
        elif cmd == CMD_SET_RAMY_RANGE and len(params) == 4:
            self._yrange = (params[0] | (params[1] << 8),
                            params[2] | (params[3] << 8))
            self._y = self._yrange[0]
        elif cmd == CMD_SET_RAMX_COUNTER and len(params) == 1:
            self._x_byte = byte
        elif cmd == CMD_SET_RAMY_COUNTER and len(params) == 2:
            self._y = params[0] | (params[1] << 8)
        elif cmd == CMD_WRITE_BLACK_VRAM:
            self._write_ram_byte(self.bw_ram, byte)
        elif cmd == CMD_WRITE_RED_VRAM:
            self._write_ram_byte(self.red_ram, byte)

    def _write_ram_byte(self, plane: bytearray, byte: int) -> None:
        bytes_per_row = (self.width + 7) // 8
        if 0 <= self._x_byte < bytes_per_row and 0 <= self._y < self.height:
            plane[self._y * bytes_per_row + self._x_byte] = byte
        x_inc = (self._entry_mode & 0x01) == 0x01
        if x_inc:
            if self._x_byte < self._xrange[1]:
                self._x_byte += 1
            else:
                self._x_byte = self._xrange[0]
                self._y += 1
        else:
            if self._x_byte > self._xrange[0]:
                self._x_byte -= 1
            else:
                self._x_byte = self._xrange[1]
                self._y += 1
