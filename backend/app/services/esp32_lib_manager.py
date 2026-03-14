"""
EspLibManager — ESP32 emulation via lcgamboa libqemu-xtensa.dll.

Exposes the same public API as EspQemuManager so simulation.py can
transparently switch between the two backends:
  - DLL available  → full GPIO + ADC + UART + I2C + SPI + RMT + WiFi (this module)
  - DLL missing    → serial-only via subprocess (esp_qemu_manager.py)

Activation: set environment variable QEMU_ESP32_LIB to the DLL path,
or place libqemu-xtensa.dll in the same directory as this module.

Events emitted via callback(event_type, data):
  system        {event: 'booting'|'booted'|'crash'|'reboot'}
  serial_output {data: str, uart: int}     — UART 0/1/2 text
  gpio_change   {pin: int, state: int}     — real GPIO number (0-39)
  gpio_dir      {pin: int, dir: int}       — 0=input 1=output
  i2c_event     {bus: int, addr: int, event: int, response: int}
  spi_event     {bus: int, event: int, response: int}
  rmt_event     {channel: int, config0: int, value: int,
                 level0: int, dur0: int, level1: int, dur1: int}
  ws2812_update {channel: int, pixels: list[{r,g,b}]}
  ledc_update   {channel: int, duty: int, duty_pct: float}
  error         {message: str}
"""
import asyncio
import logging
import os
from typing import Callable, Awaitable

from .esp32_lib_bridge import Esp32LibBridge, _DEFAULT_LIB

logger = logging.getLogger(__name__)

# DLL path: env var takes priority, then auto-detect beside this module
LIB_PATH: str = os.environ.get('QEMU_ESP32_LIB', '') or (
    _DEFAULT_LIB if os.path.isfile(_DEFAULT_LIB) else ''
)

EventCallback = Callable[[str, dict], Awaitable[None]]

# lcgamboa machine names
_MACHINE: dict[str, str] = {
    'esp32':    'esp32-picsimlab',
    'esp32-s3': 'esp32s3-picsimlab',
    'esp32-c3': 'esp32c3-picsimlab',
}

# ── WS2812 / NeoPixel RMT decoder ────────────────────────────────────────────
# WS2812 timing at 80 MHz APB (12.5 ns per tick):
#   Bit 1: high ~64 ticks (800 ns), low ~36 ticks (450 ns)
#   Bit 0: high ~32 ticks (400 ns), low ~68 ticks (850 ns)
# Threshold: high pulse > 48 ticks → bit 1
_WS2812_HIGH_THRESHOLD = 48


class _UartBuffer:
    """Accumulates bytes per UART channel, flushes on newline or size limit."""
    def __init__(self, uart_id: int, flush_size: int = 256):
        self.uart_id    = uart_id
        self.flush_size = flush_size
        self._buf: bytearray = bytearray()

    def feed(self, byte_val: int) -> str | None:
        """Add one byte. Returns decoded string if a flush occurred, else None."""
        self._buf.append(byte_val)
        if byte_val == ord('\n') or len(self._buf) >= self.flush_size:
            text = self._buf.decode('utf-8', errors='replace')
            self._buf.clear()
            return text
        return None

    def flush(self) -> str | None:
        """Force-flush any remaining bytes."""
        if self._buf:
            text = self._buf.decode('utf-8', errors='replace')
            self._buf.clear()
            return text
        return None


class _RmtDecoder:
    """
    Per-channel RMT bit accumulator for WS2812 NeoPixel decoding.

    Each RMT item encodes two pulses (level0/dur0 and level1/dur1).
    High pulses are classified as bit 1 or bit 0 based on duration.
    Every 24 bits assemble one GRB pixel, converted to RGB on output.
    A reset pulse (both durations == 0) signals end-of-frame.
    """
    def __init__(self, channel: int):
        self.channel  = channel
        self._bits:   list[int] = []
        self._pixels: list[dict] = []

    def feed(self, config0: int, value: int) -> list[dict] | None:
        """
        Process one RMT item. Returns list of {r,g,b} dicts when a full
        NeoPixel frame ends, else None.
        """
        level0, dur0, level1, dur1 = Esp32LibBridge.decode_rmt_item(value)

        # Reset pulse (end of frame)
        if dur0 == 0 and dur1 == 0:
            pixels = self._consume_pixels()
            self._bits.clear()
            return pixels or None

        # Classify the high pulse (level0=1 carries the bit)
        if level0 == 1 and dur0 > 0:
            self._bits.append(1 if dur0 > _WS2812_HIGH_THRESHOLD else 0)

        # Every 24 bits → one pixel (WS2812 GRB order)
        while len(self._bits) >= 24:
            g = self._byte(0)
            r = self._byte(8)
            b = self._byte(16)
            self._pixels.append({'r': r, 'g': g, 'b': b})
            self._bits = self._bits[24:]

        return None

    def _byte(self, offset: int) -> int:
        val = 0
        for i in range(8):
            val = (val << 1) | self._bits[offset + i]
        return val

    def _consume_pixels(self) -> list[dict]:
        pix = list(self._pixels)
        self._pixels.clear()
        return pix


class _InstanceState:
    """Runtime state for one running ESP32 instance."""

    def __init__(self, bridge: Esp32LibBridge, callback: EventCallback, board_type: str):
        self.bridge       = bridge
        self.callback     = callback
        self.board_type   = board_type
        self.reboot_count = 0
        self.crashed      = False

        # Per-UART buffers (0=main Serial, 1=Serial1, 2=Serial2)
        self.uart_bufs: dict[int, _UartBuffer] = {
            0: _UartBuffer(0),
            1: _UartBuffer(1),
            2: _UartBuffer(2),
        }

        # Per-RMT-channel decoders (lazy init)
        self.rmt_decoders: dict[int, _RmtDecoder] = {}

        # I2C device simulation: 7-bit addr → response byte
        self.i2c_responses: dict[int, int] = {}

        # SPI MISO byte returned during transfers
        self.spi_response: int = 0xFF

        self._CRASH_STR  = 'Cache disabled but cached memory region accessed'
        self._REBOOT_STR = 'Rebooting...'


class EspLibManager:
    """
    Manager for ESP32 emulation via libqemu-xtensa.dll.

    Translates raw hardware callbacks from Esp32LibBridge into rich
    WebSocket events for the Velxio frontend, including:
      • GPIO changes with real GPIO numbers (not QEMU slot indices)
      • GPIO direction tracking
      • UART output on all 3 UARTs with crash/reboot detection
      • I2C / SPI bus events with configurable device simulation
      • RMT pulse events + automatic WS2812 NeoPixel decoding
      • LEDC/PWM duty cycle polling
    """

    def __init__(self):
        self._instances: dict[str, _InstanceState] = {}

    # ── Availability ──────────────────────────────────────────────────────

    @staticmethod
    def is_available() -> bool:
        return bool(LIB_PATH) and os.path.isfile(LIB_PATH)

    # ── Public API ────────────────────────────────────────────────────────

    def start_instance(
        self,
        client_id:    str,
        board_type:   str,
        callback:     EventCallback,
        firmware_b64: str | None = None,
    ) -> None:
        if client_id in self._instances:
            logger.warning('start_instance: %s already running', client_id)
            return

        loop   = asyncio.get_event_loop()
        bridge = Esp32LibBridge(LIB_PATH, loop)
        state  = _InstanceState(bridge, callback, board_type)
        self._instances[client_id] = state

        # ── GPIO output ───────────────────────────────────────────────────
        async def _on_gpio(gpio: int, value: int) -> None:
            await callback('gpio_change', {'pin': gpio, 'state': value})

        # ── GPIO direction ────────────────────────────────────────────────
        async def _on_dir(gpio: int, direction: int) -> None:
            await callback('gpio_dir', {'pin': gpio, 'dir': direction})

        # ── UART (all channels) ───────────────────────────────────────────
        async def _on_uart(uart_id: int, byte_val: int) -> None:
            buf = state.uart_bufs.get(uart_id)
            if buf is None:
                return
            text = buf.feed(byte_val)
            if text is None:
                return

            # Crash / reboot detection (UART 0 only)
            if uart_id == 0:
                if state._CRASH_STR in text and not state.crashed:
                    state.crashed = True
                    await callback('system', {
                        'event':  'crash',
                        'reason': 'cache_error',
                        'reboot': state.reboot_count,
                    })
                if state._REBOOT_STR in text:
                    state.crashed = False
                    state.reboot_count += 1
                    await callback('system', {
                        'event': 'reboot',
                        'count': state.reboot_count,
                    })

            await callback('serial_output', {'data': text, 'uart': uart_id})

        # ── I2C sync handler (called from QEMU thread) ────────────────────
        def _i2c_sync(bus_id: int, addr: int, event: int) -> int:
            resp = state.i2c_responses.get(addr, 0)
            async def _notify() -> None:
                await callback('i2c_event', {
                    'bus': bus_id, 'addr': addr,
                    'event': event, 'response': resp,
                })
            loop.call_soon_threadsafe(
                lambda: asyncio.ensure_future(_notify(), loop=loop)
            )
            return resp

        # ── SPI sync handler (called from QEMU thread) ────────────────────
        def _spi_sync(bus_id: int, event: int) -> int:
            resp = state.spi_response
            async def _notify() -> None:
                await callback('spi_event', {
                    'bus': bus_id, 'event': event, 'response': resp,
                })
            loop.call_soon_threadsafe(
                lambda: asyncio.ensure_future(_notify(), loop=loop)
            )
            return resp

        # ── RMT + WS2812 decoder ──────────────────────────────────────────
        async def _on_rmt(channel: int, config0: int, value: int) -> None:
            if channel not in state.rmt_decoders:
                state.rmt_decoders[channel] = _RmtDecoder(channel)

            level0, dur0, level1, dur1 = Esp32LibBridge.decode_rmt_item(value)
            await callback('rmt_event', {
                'channel': channel, 'config0': config0, 'value': value,
                'level0': level0,   'dur0':    dur0,
                'level1': level1,   'dur1':    dur1,
            })

            pixels = state.rmt_decoders[channel].feed(config0, value)
            if pixels:
                await callback('ws2812_update', {
                    'channel': channel,
                    'pixels':  pixels,
                })

        # ── Helper: wrap async fn for call_soon_threadsafe ────────────────
        def _async_wrap(coro_fn):
            def _caller(*args):
                asyncio.ensure_future(coro_fn(*args), loop=loop)
            return _caller

        bridge.register_gpio_listener(_async_wrap(_on_gpio))
        bridge.register_dir_listener(_async_wrap(_on_dir))
        bridge.register_uart_listener(_async_wrap(_on_uart))
        bridge.register_i2c_handler(_i2c_sync)
        bridge.register_spi_handler(_spi_sync)
        bridge.register_rmt_listener(_async_wrap(_on_rmt))

        asyncio.ensure_future(callback('system', {'event': 'booting'}))

        machine = _MACHINE.get(board_type, 'esp32-picsimlab')
        if firmware_b64:
            try:
                bridge.start(firmware_b64, machine)
                asyncio.ensure_future(callback('system', {'event': 'booted'}))
            except Exception as exc:
                logger.error('start_instance %s: bridge.start failed: %s', client_id, exc)
                self._instances.pop(client_id, None)
                asyncio.ensure_future(callback('error', {'message': str(exc)}))
        else:
            logger.info('start_instance %s: no firmware, waiting for load_firmware()', client_id)

    def stop_instance(self, client_id: str) -> None:
        state = self._instances.pop(client_id, None)
        if not state:
            return
        for buf in state.uart_bufs.values():
            remaining = buf.flush()
            if remaining:
                asyncio.ensure_future(
                    state.callback('serial_output', {'data': remaining, 'uart': buf.uart_id})
                )
        try:
            state.bridge.stop()
        except Exception as exc:
            logger.warning('stop_instance %s: %s', client_id, exc)

    def load_firmware(self, client_id: str, firmware_b64: str) -> None:
        """Hot-reload firmware: stop current bridge, restart with new firmware."""
        state = self._instances.get(client_id)
        if not state:
            logger.warning('load_firmware: no instance %s', client_id)
            return
        board_type = state.board_type
        callback   = state.callback
        self.stop_instance(client_id)

        async def _restart() -> None:
            await asyncio.sleep(0.3)
            self.start_instance(client_id, board_type, callback, firmware_b64)

        asyncio.create_task(_restart())

    # ── GPIO / ADC / UART control ─────────────────────────────────────────

    def set_pin_state(self, client_id: str, pin: int | str, state_val: int) -> None:
        """Drive a GPIO input pin (real GPIO number 0-39)."""
        inst = self._instances.get(client_id)
        if inst:
            inst.bridge.set_pin(int(pin), state_val)

    async def send_serial_bytes(
        self, client_id: str, data: bytes, uart_id: int = 0
    ) -> None:
        """Send bytes to ESP32 UART RX (uart_id 0/1/2)."""
        inst = self._instances.get(client_id)
        if inst:
            inst.bridge.uart_send(uart_id, data)

    def set_adc(self, client_id: str, channel: int, millivolts: int) -> None:
        """Set ADC channel voltage in millivolts (0-3300 mV → 0-4095 raw)."""
        inst = self._instances.get(client_id)
        if inst:
            inst.bridge.set_adc(channel, millivolts)

    def set_adc_raw(self, client_id: str, channel: int, raw: int) -> None:
        """Set ADC channel with 12-bit raw value (0-4095)."""
        inst = self._instances.get(client_id)
        if inst:
            inst.bridge.set_adc_raw(channel, raw)

    # ── I2C / SPI device simulation ───────────────────────────────────────

    def set_i2c_response(self, client_id: str, addr: int, response_byte: int) -> None:
        """Configure the byte returned when ESP32 reads from I2C address addr."""
        inst = self._instances.get(client_id)
        if inst:
            inst.i2c_responses[addr] = response_byte & 0xFF

    def set_spi_response(self, client_id: str, response_byte: int) -> None:
        """Configure the MISO byte returned during SPI transfers."""
        inst = self._instances.get(client_id)
        if inst:
            inst.spi_response = response_byte & 0xFF

    # ── LEDC / PWM polling ────────────────────────────────────────────────

    async def poll_ledc(self, client_id: str) -> None:
        """
        Read all 16 LEDC channels and emit ledc_update for any with non-zero duty.
        Call periodically (e.g. every 50 ms) for PWM-driven LEDs/servos.
        """
        inst = self._instances.get(client_id)
        if not inst:
            return
        for ch in range(16):
            duty = inst.bridge.get_ledc_duty(ch)
            if duty is not None and duty > 0:
                duty_pct = round(duty / 8192 * 100, 1)
                await inst.callback('ledc_update', {
                    'channel':  ch,
                    'duty':     duty,
                    'duty_pct': duty_pct,
                })

    # ── Status ────────────────────────────────────────────────────────────

    def get_status(self, client_id: str) -> dict:
        """Return runtime status for a client instance."""
        inst = self._instances.get(client_id)
        if not inst:
            return {'running': False}
        return {
            'running':      True,
            'alive':        inst.bridge.is_alive,
            'board':        inst.board_type,
            'reboot_count': inst.reboot_count,
            'crashed':      inst.crashed,
            'gpio_dir':     dict(inst.bridge._gpio_dir),
        }


esp_lib_manager = EspLibManager()
