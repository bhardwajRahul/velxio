#!/usr/bin/env python3
"""
esp32_worker.py — Standalone ESP32 QEMU subprocess worker.

Runs as a child process of esp32_lib_manager.  Loads libqemu-xtensa in its
own process address space so multiple instances can coexist without DLL state
conflicts.

stdin  line 1 : JSON config
               {"lib_path": "...", "firmware_b64": "...", "machine": "..."}
stdin  line 2+: JSON commands
               {"cmd": "set_pin",          "pin": N,       "value": V}
               {"cmd": "set_adc",          "channel": N,   "millivolts": V}
               {"cmd": "set_adc_raw",      "channel": N,   "raw": V}
               {"cmd": "uart_send",        "uart": N,      "data": "<base64>"}
               {"cmd": "set_i2c_response", "addr": N,      "response": V}
               {"cmd": "set_spi_response", "response": V}
               {"cmd": "stop"}

stdout        : JSON event lines (one per line, flushed immediately)
               {"type": "system",       "event": "booted"}
               {"type": "system",       "event": "crash",  "reason": "...", ...}
               {"type": "system",       "event": "reboot", "count": N}
               {"type": "gpio_change",  "pin": N,  "state": V}
               {"type": "gpio_dir",     "pin": N,  "dir": V}
               {"type": "uart_tx",      "uart": N, "byte": V}
               {"type": "ledc_update",  "channel": N, "duty": V, "duty_pct": F, "gpio": N|-1}
               {"type": "rmt_event",    "channel": N, ...}
               {"type": "ws2812_update","channel": N, "pixels": [...]}
               {"type": "i2c_event",    "bus": N, "addr": N, "event": N, "response": N}
               {"type": "spi_event",    "bus": N, "event": N, "response": N}
               {"type": "error",        "message": "..."}

stderr        : debug logs (never part of the JSON protocol)
"""
import base64
import ctypes
import json
import os
import sys
import tempfile
import threading

# ─── stdout helpers ──────────────────────────────────────────────────────────

_stdout_lock = threading.Lock()


def _emit(obj: dict) -> None:
    """Write one JSON event line to stdout (thread-safe, always flushed)."""
    with _stdout_lock:
        sys.stdout.write(json.dumps(obj) + '\n')
        sys.stdout.flush()


def _log(msg: str) -> None:
    """Write a debug message to stderr (invisible to parent's stdout reader)."""
    sys.stderr.write(f'[esp32_worker] {msg}\n')
    sys.stderr.flush()


# ─── GPIO pinmap (identity: slot i → GPIO i-1) ──────────────────────────────

_GPIO_COUNT = 40
_PINMAP = (ctypes.c_int16 * (_GPIO_COUNT + 1))(
    _GPIO_COUNT,
    *range(_GPIO_COUNT),
)

# ─── ctypes callback types ───────────────────────────────────────────────────

_WRITE_PIN = ctypes.CFUNCTYPE(None,            ctypes.c_int,   ctypes.c_int)
_DIR_PIN   = ctypes.CFUNCTYPE(None,            ctypes.c_int,   ctypes.c_int)
_I2C_EVENT = ctypes.CFUNCTYPE(ctypes.c_int,    ctypes.c_uint8, ctypes.c_uint8, ctypes.c_uint16)
_SPI_EVENT = ctypes.CFUNCTYPE(ctypes.c_uint8,  ctypes.c_uint8, ctypes.c_uint16)
_UART_TX   = ctypes.CFUNCTYPE(None,            ctypes.c_uint8, ctypes.c_uint8)
_RMT_EVENT = ctypes.CFUNCTYPE(None,            ctypes.c_uint8, ctypes.c_uint32, ctypes.c_uint32)


class _CallbacksT(ctypes.Structure):
    _fields_ = [
        ('picsimlab_write_pin',     _WRITE_PIN),
        ('picsimlab_dir_pin',       _DIR_PIN),
        ('picsimlab_i2c_event',     _I2C_EVENT),
        ('picsimlab_spi_event',     _SPI_EVENT),
        ('picsimlab_uart_tx_event', _UART_TX),
        ('pinmap',                  ctypes.c_void_p),
        ('picsimlab_rmt_event',     _RMT_EVENT),
    ]


# ─── RMT / WS2812 NeoPixel decoder ───────────────────────────────────────────

_WS2812_HIGH_THRESHOLD = 48  # RMT ticks; high pulse > threshold → bit 1


def _decode_rmt_item(value: int) -> tuple[int, int, int, int]:
    """Unpack a 32-bit RMT item → (level0, duration0, level1, duration1)."""
    level0    = (value >> 31) & 1
    duration0 = (value >> 16) & 0x7FFF
    level1    = (value >> 15) & 1
    duration1 =  value        & 0x7FFF
    return level0, duration0, level1, duration1


class _RmtDecoder:
    """Accumulate RMT items for one channel; flush complete WS2812 frames."""

    def __init__(self, channel: int):
        self.channel  = channel
        self._bits:   list[int] = []
        self._pixels: list[dict] = []

    @staticmethod
    def _bits_to_byte(bits: list[int], offset: int) -> int:
        val = 0
        for i in range(8):
            val = (val << 1) | bits[offset + i]
        return val

    def feed(self, value: int) -> list[dict] | None:
        """
        Process one RMT item.
        Returns a list of {r, g, b} pixel dicts on end-of-frame, else None.
        """
        level0, dur0, _, dur1 = _decode_rmt_item(value)

        # Reset pulse (both durations zero) signals end of frame
        if dur0 == 0 and dur1 == 0:
            pix = list(self._pixels)
            self._pixels.clear()
            self._bits.clear()
            return pix or None

        # Classify the high pulse → bit 1 or bit 0
        if level0 == 1 and dur0 > 0:
            self._bits.append(1 if dur0 > _WS2812_HIGH_THRESHOLD else 0)

        # Every 24 bits → one GRB pixel → convert to RGB
        while len(self._bits) >= 24:
            g = self._bits_to_byte(self._bits, 0)
            r = self._bits_to_byte(self._bits, 8)
            b = self._bits_to_byte(self._bits, 16)
            self._pixels.append({'r': r, 'g': g, 'b': b})
            self._bits = self._bits[24:]

        return None


# ─── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:  # noqa: C901  (complexity OK for inline worker)
    # ── 1. Read config from stdin ─────────────────────────────────────────────
    raw_cfg = sys.stdin.readline()
    if not raw_cfg.strip():
        _log('No config received on stdin — exiting')
        os._exit(1)
    try:
        cfg = json.loads(raw_cfg)
    except Exception as exc:
        _log(f'Bad config JSON: {exc}')
        os._exit(1)

    lib_path     = cfg['lib_path']
    firmware_b64 = cfg['firmware_b64']
    machine      = cfg.get('machine', 'esp32-picsimlab')

    # ── 2. Load DLL ───────────────────────────────────────────────────────────
    _MINGW64_BIN = r'C:\msys64\mingw64\bin'
    if os.name == 'nt' and os.path.isdir(_MINGW64_BIN):
        os.add_dll_directory(_MINGW64_BIN)
    try:
        lib = ctypes.CDLL(lib_path)
    except Exception as exc:
        _emit({'type': 'error', 'message': f'Cannot load DLL: {exc}'})
        os._exit(1)

    # ── 3. Write firmware to a temp file ──────────────────────────────────────
    try:
        fw_bytes = base64.b64decode(firmware_b64)
        tmp = tempfile.NamedTemporaryFile(suffix='.bin', delete=False)
        tmp.write(fw_bytes)
        tmp.close()
        firmware_path: str | None = tmp.name
    except Exception as exc:
        _emit({'type': 'error', 'message': f'Firmware decode error: {exc}'})
        os._exit(1)

    rom_dir   = os.path.dirname(lib_path).encode()
    args_list = [
        b'qemu',
        b'-M', machine.encode(),
        b'-nographic',
        b'-L', rom_dir,
        b'-drive', f'file={firmware_path},if=mtd,format=raw'.encode(),
    ]
    argc = len(args_list)
    argv = (ctypes.c_char_p * argc)(*args_list)

    # ── 4. Shared mutable state ───────────────────────────────────────────────
    _stopped       = threading.Event()      # set on "stop" command
    _init_done     = threading.Event()      # set when qemu_init() returns
    _i2c_responses: dict[int, int] = {}     # 7-bit addr → response byte
    _spi_response   = [0xFF]                # MISO byte for SPI transfers
    _rmt_decoders:  dict[int, _RmtDecoder] = {}
    _uart0_buf      = bytearray()           # accumulate UART0 for crash detection
    _reboot_count   = [0]
    _crashed        = [False]
    _CRASH_STR      = b'Cache disabled but cached memory region accessed'
    _REBOOT_STR     = b'Rebooting...'
    # LEDC channel → GPIO pin (populated from GPIO out_sel sync events)
    # ESP32 signal indices: 72-79 = LEDC HS ch 0-7, 80-87 = LEDC LS ch 0-7
    _ledc_gpio_map: dict[int, int] = {}

    # ── 5. ctypes callbacks (called from QEMU thread) ─────────────────────────

    def _on_pin_change(slot: int, value: int) -> None:
        if _stopped.is_set():
            return
        gpio = int(_PINMAP[slot]) if 1 <= slot <= _GPIO_COUNT else slot
        _emit({'type': 'gpio_change', 'pin': gpio, 'state': value})

    def _on_dir_change(slot: int, direction: int) -> None:
        if _stopped.is_set():
            return
        # slot == -1 means a sync event from GPIO/LEDC/IOMUX peripheral
        if slot == -1:
            marker = direction & 0xF000
            if marker == 0x2000:  # GPIO_FUNCX_OUT_SEL_CFG change
                gpio_pin = direction & 0xFF
                signal   = (direction >> 8) & 0xFF
                # Signal 72-79 = LEDC HS ch 0-7; 80-87 = LEDC LS ch 0-7
                if 72 <= signal <= 87:
                    ledc_ch = signal - 72  # ch 0-15
                    _ledc_gpio_map[ledc_ch] = gpio_pin
            return
        gpio = int(_PINMAP[slot]) if 1 <= slot <= _GPIO_COUNT else slot
        _emit({'type': 'gpio_dir', 'pin': gpio, 'dir': direction})

    def _on_uart_tx(uart_id: int, byte_val: int) -> None:
        if _stopped.is_set():
            return
        _emit({'type': 'uart_tx', 'uart': uart_id, 'byte': byte_val})
        # Crash / reboot detection on UART0 only
        if uart_id == 0:
            _uart0_buf.append(byte_val)
            if byte_val == ord('\n') or len(_uart0_buf) >= 512:
                chunk = bytes(_uart0_buf)
                _uart0_buf.clear()
                if _CRASH_STR in chunk and not _crashed[0]:
                    _crashed[0] = True
                    _emit({'type': 'system', 'event': 'crash',
                           'reason': 'cache_error', 'reboot': _reboot_count[0]})
                if _REBOOT_STR in chunk:
                    _crashed[0] = False
                    _reboot_count[0] += 1
                    _emit({'type': 'system', 'event': 'reboot',
                           'count': _reboot_count[0]})

    def _on_rmt_event(channel: int, config0: int, value: int) -> None:
        if _stopped.is_set():
            return
        level0, dur0, level1, dur1 = _decode_rmt_item(value)
        _emit({'type': 'rmt_event', 'channel': channel, 'config0': config0,
               'value': value, 'level0': level0, 'dur0': dur0,
               'level1': level1, 'dur1': dur1})
        if channel not in _rmt_decoders:
            _rmt_decoders[channel] = _RmtDecoder(channel)
        pixels = _rmt_decoders[channel].feed(value)
        if pixels:
            _emit({'type': 'ws2812_update', 'channel': channel, 'pixels': pixels})

    def _on_i2c_event(bus_id: int, addr: int, event: int) -> int:
        """Synchronous — must return immediately; called from QEMU thread."""
        resp = _i2c_responses.get(addr, 0)
        if not _stopped.is_set():
            _emit({'type': 'i2c_event', 'bus': bus_id, 'addr': addr,
                   'event': event, 'response': resp})
        return resp

    def _on_spi_event(bus_id: int, event: int) -> int:
        """Synchronous — must return immediately; called from QEMU thread."""
        resp = _spi_response[0]
        if not _stopped.is_set():
            _emit({'type': 'spi_event', 'bus': bus_id, 'event': event, 'response': resp})
        return resp

    # Keep callback struct alive (prevent GC from freeing ctypes closures)
    _cbs_ref = _CallbacksT(
        picsimlab_write_pin     = _WRITE_PIN(_on_pin_change),
        picsimlab_dir_pin       = _DIR_PIN(_on_dir_change),
        picsimlab_i2c_event     = _I2C_EVENT(_on_i2c_event),
        picsimlab_spi_event     = _SPI_EVENT(_on_spi_event),
        picsimlab_uart_tx_event = _UART_TX(_on_uart_tx),
        pinmap                  = ctypes.cast(_PINMAP, ctypes.c_void_p).value,
        picsimlab_rmt_event     = _RMT_EVENT(_on_rmt_event),
    )
    lib.qemu_picsimlab_register_callbacks(ctypes.byref(_cbs_ref))

    # ── 6. QEMU thread ────────────────────────────────────────────────────────

    def _qemu_thread() -> None:
        try:
            lib.qemu_init(argc, argv, None)
        except Exception as exc:
            _emit({'type': 'error', 'message': f'qemu_init failed: {exc}'})
        finally:
            _init_done.set()
        lib.qemu_main_loop()

    qemu_t = threading.Thread(target=_qemu_thread, daemon=True, name=f'qemu-{machine}')
    qemu_t.start()

    if not _init_done.wait(timeout=30.0):
        _emit({'type': 'error', 'message': 'qemu_init timed out after 30 s'})
        os._exit(1)

    _emit({'type': 'system', 'event': 'booted'})
    _log(f'QEMU started: machine={machine} firmware={firmware_path}')

    # ── 7. LEDC polling thread (100 ms interval) ──────────────────────────────

    def _ledc_poll_thread() -> None:
        lib.qemu_picsimlab_get_internals.restype = ctypes.c_void_p
        while not _stopped.wait(0.1):
            try:
                ptr = lib.qemu_picsimlab_get_internals(0)
                if ptr is None:
                    continue
                arr = (ctypes.c_uint32 * 16).from_address(ptr)
                for ch in range(16):
                    duty = int(arr[ch])
                    if duty > 0:
                        gpio = _ledc_gpio_map.get(ch, -1)
                        _emit({'type': 'ledc_update', 'channel': ch,
                               'duty': duty,
                               'duty_pct': round(duty / 8192 * 100, 1),
                               'gpio': gpio})
            except Exception:
                pass

    threading.Thread(target=_ledc_poll_thread, daemon=True, name='ledc-poll').start()

    # ── 8. Command loop (main thread reads stdin) ─────────────────────────────

    for raw_line in sys.stdin:
        raw_line = raw_line.strip()
        if not raw_line:
            continue
        try:
            cmd = json.loads(raw_line)
        except Exception:
            continue

        c = cmd.get('cmd', '')

        if c == 'set_pin':
            # Identity pinmap: slot = gpio_num + 1
            lib.qemu_picsimlab_set_pin(int(cmd['pin']) + 1, int(cmd['value']))

        elif c == 'set_adc':
            raw_v = int(int(cmd['millivolts']) * 4095 / 3300)
            lib.qemu_picsimlab_set_apin(int(cmd['channel']), max(0, min(4095, raw_v)))

        elif c == 'set_adc_raw':
            lib.qemu_picsimlab_set_apin(int(cmd['channel']),
                                        max(0, min(4095, int(cmd['raw']))))

        elif c == 'uart_send':
            data = base64.b64decode(cmd['data'])
            buf  = (ctypes.c_uint8 * len(data))(*data)
            lib.qemu_picsimlab_uart_receive(int(cmd.get('uart', 0)), buf, len(data))

        elif c == 'set_i2c_response':
            _i2c_responses[int(cmd['addr'])] = int(cmd['response']) & 0xFF

        elif c == 'set_spi_response':
            _spi_response[0] = int(cmd['response']) & 0xFF

        elif c == 'stop':
            _stopped.set()
            # Signal QEMU to shut down. The assertion that fires on Windows
            # ("Bail out!") is non-fatal — glib just logs it and continues.
            try:
                lib.qemu_cleanup()
            except Exception:
                pass
            qemu_t.join(timeout=5.0)
            # Clean up temp firmware file
            if firmware_path:
                try:
                    os.unlink(firmware_path)
                except OSError:
                    pass
            os._exit(0)


if __name__ == '__main__':
    main()
