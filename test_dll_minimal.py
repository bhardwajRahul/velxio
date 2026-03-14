"""Minimal test: start lcgamboa QEMU DLL with blink firmware and collect output."""
import ctypes, os, sys, threading, time, pathlib

MINGW = r"C:\msys64\mingw64\bin"
DLL   = r"E:\Hardware\wokwi_clon\backend\app\services\libqemu-xtensa.dll"
FW    = r"E:\Hardware\wokwi_clon\test\esp32-emulator\binaries\esp32_blink.ino.merged.bin"

sys.path.insert(0, r"E:\Hardware\wokwi_clon\backend")
from app.services.esp32_lib_bridge import (
    _WRITE_PIN, _DIR_PIN, _I2C_EVENT, _SPI_EVENT, _UART_TX, _RMT_EVENT,
    _CallbacksT, _PINMAP,
)

print("=== Loading DLL ===")
os.add_dll_directory(MINGW)
lib = ctypes.CDLL(DLL)
print("  OK")

uart_buf   = bytearray()
gpio_events = []

def on_write_pin(pin, value):
    gpio_events.append((pin, value))
    print(f"  [GPIO] pin={pin} value={value}")

def on_dir_pin(pin, dir_):
    pass

def on_uart_tx(uart_id, byte_val):
    uart_buf.append(byte_val)
    if byte_val == ord('\n'):
        line = uart_buf.decode("utf-8", errors="replace").rstrip()
        uart_buf.clear()
        print(f"  [UART] {line}")

cb_write = _WRITE_PIN(on_write_pin)
cb_dir   = _DIR_PIN(on_dir_pin)
cb_i2c   = _I2C_EVENT(lambda *a: 0)
cb_spi   = _SPI_EVENT(lambda *a: 0)
cb_uart  = _UART_TX(on_uart_tx)
cb_rmt   = _RMT_EVENT(lambda *a: None)

cbs = _CallbacksT(
    picsimlab_write_pin     = cb_write,
    picsimlab_dir_pin       = cb_dir,
    picsimlab_i2c_event     = cb_i2c,
    picsimlab_spi_event     = cb_spi,
    picsimlab_uart_tx_event = cb_uart,
    pinmap                  = ctypes.cast(_PINMAP, ctypes.c_void_p).value,
    picsimlab_rmt_event     = cb_rmt,
)
_keep_alive = (cbs, cb_write, cb_dir, cb_i2c, cb_spi, cb_uart, cb_rmt)

print("=== Registering callbacks ===")
lib.qemu_picsimlab_register_callbacks(ctypes.byref(cbs))

fw_bytes = FW.encode()
args = [b"qemu", b"-M", b"esp32-picsimlab", b"-nographic",
        b"-drive", b"file=" + fw_bytes + b",if=mtd,format=raw"]
argc = len(args)
argv = (ctypes.c_char_p * argc)(*args)

print("=== Calling qemu_init ===")
lib.qemu_init(argc, argv, None)
print("=== qemu_init returned, starting main_loop thread ===")

t = threading.Thread(target=lib.qemu_main_loop, daemon=True, name="qemu-test")
t.start()

print("=== Waiting 20s for output ===")
time.sleep(20)

print(f"\n=== Results ===")
print(f"UART bytes: {len(uart_buf)} buffered, output so far:")
print(f"GPIO events: {len(gpio_events)}")
for ev in gpio_events[:20]:
    print(f"  pin={ev[0]} value={ev[1]}")
print(f"Thread alive: {t.is_alive()}")
