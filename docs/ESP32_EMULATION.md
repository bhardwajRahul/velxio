# ESP32 Emulation — Documentación Técnica

> Estado: **Funcional** · Backend completo · Frontend parcial
> Motor: **lcgamboa/qemu-8.1.3** · Plataforma: **arduino-esp32 2.0.17 (IDF 4.4.x)**

---

## 1. Arquitectura general

```
Usuario (browser)
  └── WebSocket (/ws/{client_id})
        └── simulation.py  (FastAPI router)
              ├── EspLibManager          ← backend con DLL (GPIO, WiFi, I2C, SPI, RMT…)
              └── EspQemuManager         ← fallback solo-UART via subprocess
                    │
              [QEMU_ESP32_LIB=libqemu-xtensa.dll]
                    │
              Esp32LibBridge (ctypes)
                    │
              libqemu-xtensa.dll  ←  lcgamboa fork de QEMU 8.1.3
                    │
              Machine: esp32-picsimlab
                    │
         ┌──────────┴──────────┐
     CPU Xtensa LX6      periféricos emulados
     (dual-core)    GPIO · ADC · UART · I2C · SPI
                    RMT · LEDC · Timer · WiFi · Flash
```

El sistema selecciona backend automáticamente:
- **DLL disponible** → `EspLibManager` (GPIO completo + todos los periféricos)
- **DLL ausente** → `EspQemuManager` (solo UART serial via TCP, subprocess QEMU)

Activación de DLL: colocar `libqemu-xtensa.dll` en `backend/app/services/` o setear:
```bash
QEMU_ESP32_LIB=C:/ruta/a/libqemu-xtensa.dll uvicorn app.main:app
```

---

## 2. Componentes del sistema

### 2.1 `libqemu-xtensa.dll`

Compilada desde el fork [lcgamboa/qemu](https://github.com/lcgamboa/qemu) rama `qemu-8.1.3`.

**Dependencias en runtime (Windows):**
```
C:\msys64\mingw64\bin\
  libglib-2.0-0.dll
  libgcrypt-20.dll
  libgpg-error-0.dll
  libslirp-0.dll
  libintl-8.dll
  libpcre2-8-0.dll
  (y ~15 DLLs más de MinGW64)
```

El bridge las registra automáticamente con `os.add_dll_directory()`.

**ROM binaries requeridas** (deben estar en la misma carpeta que la DLL):
```
backend/app/services/
  libqemu-xtensa.dll        ← motor principal
  esp32-v3-rom.bin          ← ROM de boot del ESP32 (copiar de esp-qemu)
  esp32-v3-rom-app.bin      ← ROM de aplicación
```

**Cómo obtener los ROM binaries:**
```bash
# Desde instalación de Espressif QEMU:
copy "C:\esp-qemu\qemu\share\qemu\esp32-v3-rom.bin" backend\app\services\
copy "C:\esp-qemu\qemu\share\qemu\esp32-v3-rom-app.bin" backend\app\services\
```

**Exports de la DLL:**
```c
void    qemu_init(int argc, char** argv, char** envp)
void    qemu_main_loop(void)
void    qemu_cleanup(void)
void    qemu_picsimlab_register_callbacks(callbacks_t* cbs)
void    qemu_picsimlab_set_pin(int slot, int value)        // GPIO input
void    qemu_picsimlab_set_apin(int channel, int value)    // ADC input (0-4095)
void    qemu_picsimlab_uart_receive(int id, uint8_t* buf, int size)
void*   qemu_picsimlab_get_internals(int type)             // LEDC duty array
int     qemu_picsimlab_get_TIOCM(void)                     // UART modem lines
```

**Struct de callbacks C:**
```c
typedef struct {
    void    (*picsimlab_write_pin)(int pin, int value);       // GPIO output changed
    void    (*picsimlab_dir_pin)(int pin, int value);         // GPIO direction changed
    int     (*picsimlab_i2c_event)(uint8_t id, uint8_t addr, uint16_t event);
    uint8_t (*picsimlab_spi_event)(uint8_t id, uint16_t event);
    void    (*picsimlab_uart_tx_event)(uint8_t id, uint8_t value);
    const short int *pinmap;   // slot → GPIO number mapping
    void    (*picsimlab_rmt_event)(uint8_t ch, uint32_t config0, uint32_t value);
} callbacks_t;
```

---

### 2.2 GPIO Pinmap

```python
# Identity mapping: QEMU IRQ slot i → GPIO number i-1
_PINMAP = (ctypes.c_int16 * 41)(
    40,               # pinmap[0] = count
    *range(40)        # pinmap[1..40] = GPIO 0..39
)
```

Cuando GPIO N cambia, QEMU llama `picsimlab_write_pin(slot=N+1, value)`.
El bridge traduce automáticamente slot → GPIO real antes de notificar listeners.

**GPIOs input-only en ESP32-WROOM-32:** `{34, 35, 36, 39}` — no pueden ser output.

---

### 2.3 `Esp32LibBridge` (Python ctypes)

Archivo: `backend/app/services/esp32_lib_bridge.py`

```python
bridge = Esp32LibBridge(lib_path, asyncio_loop)

# Registrar listeners (async, llamados desde asyncio)
bridge.register_gpio_listener(fn)    # fn(gpio_num: int, value: int)
bridge.register_dir_listener(fn)     # fn(gpio_num: int, direction: int)
bridge.register_uart_listener(fn)    # fn(uart_id: int, byte_val: int)
bridge.register_rmt_listener(fn)     # fn(channel: int, config0: int, value: int)

# Registrar handlers I2C/SPI (sync, llamados desde thread QEMU)
bridge.register_i2c_handler(fn)      # fn(bus, addr, event) -> int
bridge.register_spi_handler(fn)      # fn(bus, event) -> int

# Control
bridge.start(firmware_b64, machine='esp32-picsimlab')
bridge.stop()
bridge.is_alive  # bool

# GPIO / ADC / UART
bridge.set_pin(gpio_num, value)      # Drive GPIO input (usa GPIO real 0-39)
bridge.set_adc(channel, millivolts)  # ADC en mV (0-3300)
bridge.set_adc_raw(channel, raw)     # ADC en raw 12-bit (0-4095)
bridge.uart_send(uart_id, data)      # Enviar bytes al UART RX del ESP32

# LEDC/PWM
bridge.get_ledc_duty(channel)        # canal 0-15 → raw duty | None
bridge.get_tiocm()                   # UART modem lines bitmask

# Helper
bridge.decode_rmt_item(value)        # → (level0, dur0, level1, dur1)
```

**Threading crítico:**
`qemu_init()` y `qemu_main_loop()` **deben correr en el mismo thread** (BQL — Big QEMU Lock es thread-local). El bridge los ejecuta en un único daemon thread y usa `threading.Event` para sincronizar el inicio:

```python
# Correcto:
def _qemu_thread():
    lib.qemu_init(argc, argv, None)   # init + init_done.set()
    lib.qemu_main_loop()              # bloquea indefinidamente

# Incorrecto:
lib.qemu_init(...)         # en thread A
lib.qemu_main_loop()       # en thread B  ← crash: "qemu_mutex_unlock_iothread assertion failed"
```

---

### 2.4 `EspLibManager` (Python)

Archivo: `backend/app/services/esp32_lib_manager.py`

Convierte callbacks de hardware en **eventos WebSocket** para el frontend:

| Evento emitido | Datos | Cuándo |
|----------------|-------|--------|
| `system` | `{event: 'booting'\|'booted'\|'crash'\|'reboot', ...}` | Ciclo de vida |
| `serial_output` | `{data: str, uart: 0\|1\|2}` | UART TX del ESP32 |
| `gpio_change` | `{pin: int, state: 0\|1}` | GPIO output cambia |
| `gpio_dir` | `{pin: int, dir: 0\|1}` | GPIO cambia dirección |
| `i2c_event` | `{bus, addr, event, response}` | Transacción I2C |
| `spi_event` | `{bus, event, response}` | Transacción SPI |
| `rmt_event` | `{channel, config0, value, level0, dur0, level1, dur1}` | Pulso RMT |
| `ws2812_update` | `{channel, pixels: [{r,g,b}]}` | Frame NeoPixel completo |
| `ledc_update` | `{channel, duty, duty_pct}` | PWM duty cycle |
| `error` | `{message: str}` | Error de boot |

**Detección de crash y reboot:**
```python
# El firmware imprime en UART cuando crashea:
"Cache disabled but cached memory region accessed"  → event: crash
"Rebooting..."                                      → event: reboot
```

**API pública del manager:**
```python
manager = esp_lib_manager  # singleton

manager.start_instance(client_id, board_type, callback, firmware_b64)
manager.stop_instance(client_id)
manager.load_firmware(client_id, firmware_b64)        # hot-reload

manager.set_pin_state(client_id, gpio_num, value)     # GPIO input
manager.set_adc(client_id, channel, millivolts)
manager.set_adc_raw(client_id, channel, raw)
await manager.send_serial_bytes(client_id, data, uart_id=0)

manager.set_i2c_response(client_id, addr, byte)       # Simular dispositivo I2C
manager.set_spi_response(client_id, byte)             # Simular dispositivo SPI
await manager.poll_ledc(client_id)                    # Leer PWM (llamar periódicamente)
manager.get_status(client_id)                         # → dict con runtime state
```

---

### 2.5 `simulation.py` — Mensajes WebSocket

**Frontend → Backend (mensajes entrantes):**

| Tipo | Datos | Acción |
|------|-------|--------|
| `start_esp32` | `{board, firmware_b64?}` | Iniciar emulación |
| `stop_esp32` | `{}` | Detener |
| `load_firmware` | `{firmware_b64}` | Hot-reload firmware |
| `esp32_gpio_in` | `{pin, state}` | Drive GPIO input (GPIO real 0-39) |
| `esp32_serial_input` | `{bytes: [int], uart: 0}` | Enviar serial al ESP32 |
| `esp32_uart1_input` | `{bytes: [int]}` | UART1 RX |
| `esp32_uart2_input` | `{bytes: [int]}` | UART2 RX |
| `esp32_adc_set` | `{channel, millivolts?}` o `{channel, raw?}` | Setear ADC |
| `esp32_i2c_response` | `{addr, response}` | Configurar respuesta I2C |
| `esp32_spi_response` | `{response}` | Configurar MISO SPI |
| `esp32_status` | `{}` | Query estado runtime |

---

## 3. Firmware — Requisitos para lcgamboa

### 3.1 Versión de plataforma requerida

**✅ Usar: arduino-esp32 2.x (IDF 4.4.x)**
**❌ No usar: arduino-esp32 3.x (IDF 5.x)**

```bash
# Instalar/cambiar a 2.x:
arduino-cli core install esp32:esp32@2.0.17
```

**Por qué:** El WiFi emulado de lcgamboa (core 1) desactiva la caché SPI flash periódicamente. En IDF 5.x esto provoca un crash cuando las interrupciones del core 0 intentan ejecutar código desde IROM (flash cache). En IDF 4.4.x el comportamiento de la caché es diferente y compatible.

**Mensaje de crash (IDF 5.x):**
```
Guru Meditation Error: Core  / panic'ed (Cache error).
Cache disabled but cached memory region accessed
EXCCAUSE: 0x00000007
```

### 3.2 Imagen de flash

La imagen debe ser un archivo binario completo de **4 MB** (formato merged flash):

```bash
# Compilar con DIO flash mode:
arduino-cli compile --fqbn esp32:esp32:esp32:FlashMode=dio \
  --output-dir build/ sketch/

# Crear imagen 4MB completa (¡obligatorio! QEMU requiere 2/4/8/16 MB exactos):
esptool --chip esp32 merge_bin \
  --fill-flash-size 4MB \          # ← sin esto QEMU falla con "only 2,4,8,16 MB supported"
  -o firmware.merged.bin \
  --flash_mode dio --flash_size 4MB \
  0x1000  bootloader.bin \
  0x8000  partitions.bin \
  0x10000 app.bin
```

El backend (`arduino_cli.py`) fuerza `FlashMode=dio` automáticamente para todos los targets `esp32:*`.

### 3.3 Sketch compatible con lcgamboa (ejemplo mínimo)

Para sketches que necesiten máxima compatibilidad (sin Arduino framework):

```cpp
// GPIO directo vía registros (evita código en flash en ISRs)
#define GPIO_OUT_W1TS    (*((volatile uint32_t*)0x3FF44008))
#define GPIO_OUT_W1TC    (*((volatile uint32_t*)0x3FF4400C))
#define GPIO_ENABLE_W1TS (*((volatile uint32_t*)0x3FF44020))
#define LED_BIT          (1u << 2)   // GPIO2

// Funciones ROM (siempre en IRAM, nunca crashean)
extern "C" {
    void ets_delay_us(uint32_t us);
    int  esp_rom_printf(const char* fmt, ...);
}

// Strings en DRAM (no en flash)
static const char DRAM_ATTR s_on[]  = "LED_ON\n";
static const char DRAM_ATTR s_off[] = "LED_OFF\n";

void IRAM_ATTR setup() {
    GPIO_ENABLE_W1TS = LED_BIT;
    for (int i = 0; i < 5; i++) {
        GPIO_OUT_W1TS = LED_BIT;
        esp_rom_printf(s_on);
        ets_delay_us(300000);          // 300 ms
        GPIO_OUT_W1TC = LED_BIT;
        esp_rom_printf(s_off);
        ets_delay_us(300000);
    }
}

void IRAM_ATTR loop() { ets_delay_us(1000000); }
```

**Sketches Arduino normales** (con `Serial.print`, `delay`, `digitalWrite`) también funcionan correctamente con IDF 4.4.x.

---

## 4. WiFi emulada

lcgamboa implementa una WiFi simulada con SSIDs hardcoded:

```cpp
// Solo estas redes están disponibles en la emulación:
WiFi.begin("PICSimLabWifi", "");    // sin contraseña
WiFi.begin("Espressif", "");
```

El ESP32 emulado puede:
- Escanear redes (`WiFi.scanNetworks()`) → devuelve las dos SSIDs
- Conectar y obtener IP (`192.168.4.x`)
- Abrir sockets TCP/UDP (via SLIRP — NAT hacia el host)
- Usar `HTTPClient`, `WebServer`, etc.

**Limitaciones:**
- No hay forma de configurar las SSIDs o contraseñas desde Python
- La IP del "router" virtual es `10.0.2.2` (host Windows)
- El ESP32 emulado es accesible en `localhost:PORT` via port forwarding SLIRP

---

## 5. I2C emulado

El callback I2C es **síncrono** — QEMU espera la respuesta antes de continuar:

```python
# Protocolo de eventos I2C (campo `event`):
0x0100  # START + dirección (READ si bit0 de addr=1)
0x0200  # WRITE byte (byte en bits 7:0 del event)
0x0300  # READ request (el callback debe retornar el byte a poner en SDA)
0x0000  # STOP / idle
```

**Simular un sensor I2C** (ej. temperatura):
```python
# Configurar qué byte devuelve el ESP32 cuando lee la dirección 0x48:
esp_lib_manager.set_i2c_response(client_id, addr=0x48, response_byte=75)
# → analogRead equivalente: el firmware leerá 75 de ese registro
```

Desde WebSocket:
```json
{"type": "esp32_i2c_response", "data": {"addr": 72, "response": 75}}
```

---

## 6. RMT / NeoPixel (WS2812)

El evento RMT lleva un item de 32 bits codificado así:
```
bit31: level0  | bits[30:16]: duration0 | bit15: level1 | bits[14:0]: duration1
```

El `_RmtDecoder` acumula bits y decodifica frames WS2812 (24 bits por LED en orden GRB):

```python
# Threshold de bit: pulso alto > 48 ticks (a 80 MHz APB = ~600 ns) → bit 1
_WS2812_HIGH_THRESHOLD = 48

# Bit 1: high ~64 ticks (800 ns), low ~36 ticks (450 ns)
# Bit 0: high ~32 ticks (400 ns), low ~68 ticks (850 ns)
```

El evento emitido al frontend:
```json
{
  "type": "ws2812_update",
  "data": {
    "channel": 0,
    "pixels": [
      {"r": 255, "g": 0, "b": 0},
      {"r": 0, "g": 255, "b": 0}
    ]
  }
}
```

---

## 7. LEDC / PWM

`qemu_picsimlab_get_internals(0)` retorna un puntero a un array de 16 `uint32_t` con el duty cycle de cada canal LEDC. Llamar periódicamente (cada ~50 ms):

```python
await esp_lib_manager.poll_ledc(client_id)
# Emite: {"type": "ledc_update", "data": {"channel": 0, "duty": 4096, "duty_pct": 50.0}}
```

El duty máximo típico es 8192 (timer de 13 bits). Para brillo de LED: `duty_pct / 100`.

---

## 8. Compilación de la DLL

### 8.1 Requisitos

- **MSYS2** instalado en `C:\msys64`
- Paquetes MINGW64: `gcc glib2 libgcrypt libslirp pixman ninja meson python git`

```bash
pacman -S mingw-w64-x86_64-{gcc,glib2,libgcrypt,libslirp,pixman,ninja,meson,python,git}
```

### 8.2 Proceso de build

```bash
# 1. Configurar (en MSYS2 MINGW64):
cd wokwi-libs/qemu-lcgamboa
./configure \
  --target-list=xtensa-softmmu \
  --disable-werror --enable-tcg \
  --enable-gcrypt --enable-slirp \
  --enable-iconv --without-default-features

# 2. Compilar el binario principal:
ninja -j$(nproc) qemu-system-xtensa.exe

# 3. Relinkar como DLL (script automatizado):
bash build_qemu_step4.sh
# → genera libqemu-xtensa.dll en build/
# → la copia a backend/app/services/
```

### 8.3 Detalle del relink como DLL

El proceso extrae el comando de link de `build.ninja`, elimina `softmmu_main.c.obj` (que contiene `main()`), y agrega flags de DLL:

```bash
cc -m64 -mcx16 -shared \
   -Wl,--export-all-symbols \
   -Wl,--allow-multiple-definition \
   -o libqemu-xtensa.dll \
   @dll_link.rsp      # todos los .obj excepto softmmu_main
```

### 8.4 Verificar exports

```bash
objdump -p libqemu-xtensa.dll | grep -i "qemu_picsimlab\|qemu_init\|qemu_main"
# Debe mostrar:
#   qemu_init
#   qemu_main_loop
#   qemu_cleanup
#   qemu_picsimlab_register_callbacks
#   qemu_picsimlab_set_pin
#   qemu_picsimlab_set_apin
#   qemu_picsimlab_uart_receive
#   qemu_picsimlab_get_internals
#   qemu_picsimlab_get_TIOCM
```

### 8.5 Parche requerido en scripts/symlink-install-tree.py

Windows no permite crear symlinks sin privilegios de administrador. El script de QEMU falla con `WinError 1314`. Parche aplicado:

```python
# En scripts/symlink-install-tree.py, dentro del loop de symlinks:
if os.name == 'nt':
    if not os.path.exists(source):
        continue
    import shutil
    try:
        shutil.copy2(source, bundle_dest)
    except Exception as copy_err:
        print(f'error copying {source}: {copy_err}', file=sys.stderr)
    continue
```

---

## 9. Tests

Archivo: `test/esp32/test_esp32_lib_bridge.py`

```bash
# Ejecutar todos los tests:
backend/venv/Scripts/python.exe -m pytest test/esp32/test_esp32_lib_bridge.py -v

# Resultado esperado: 28 passed en ~13 segundos
```

**Grupos de tests:**

| Grupo | Tests | Qué verifica |
|-------|-------|--------------|
| `TestDllExists` | 5 | Rutas de DLL, ROM binaries, MinGW64 |
| `TestDllLoads` | 3 | Carga de DLL, symbols exportados |
| `TestPinmap` | 3 | Estructura del pinmap, GPIO2 en slot 3 |
| `TestManagerAvailability` | 2 | `is_available()`, API surface |
| `TestEsp32LibIntegration` | 15 | QEMU real con firmware blink: boot, UART, GPIO, ADC, SPI, I2C |

**Firmware de test:** `test/esp32-emulator/binaries_lcgamboa/blink_lcgamboa.ino.merged.bin`
Compilado con arduino-esp32 2.0.17, DIO flash mode, imagen 4MB completa.

---

## 10. Limitaciones conocidas (no solucionables sin modificar QEMU)

| Limitación | Causa | Workaround |
|------------|-------|------------|
| **Una sola instancia ESP32 por proceso** | QEMU usa estado global en variables estáticas | Lanzar múltiples procesos Python |
| **WiFi solo con SSIDs hardcoded** | lcgamboa codifica "PICSimLabWifi" y "Espressif" en C | Modificar y recompilar la DLL |
| **Sin BLE / Bluetooth Classic** | No implementado en lcgamboa | No disponible |
| **Sin touch capacitivo** | `touchRead()` no tiene callback en picsimlab | No disponible |
| **Sin DAC** | GPIO25/GPIO26 analógico no expuesto por picsimlab | No disponible |
| **Flash fija en 4MB** | Hardcoded en la machine esp32-picsimlab | Recompilar DLL |
| **arduino-esp32 3.x causa crash** | IDF 5.x maneja caché diferente al WiFi emulado | Usar 2.x (IDF 4.4.x) |

---

## 11. Pendiente en el frontend

Los eventos son emitidos por el backend pero el frontend aún no los consume:

| Evento | Componente frontend a crear |
|--------|-----------------------------|
| `ws2812_update` | `NeoPixel.tsx` — strip de LEDs RGB |
| `ledc_update` | Modificar `LED.tsx` para brillo variable |
| `gpio_change` | Conectar al `PinManager` del ESP32 (análogo al AVR) |
| `gpio_dir` | Mostrar dirección de pin en el inspector |
| `i2c_event` | Sensores I2C simulados (SSD1306, BME280, etc.) |
| `spi_event` | Displays SPI (ILI9341 ya implementado para AVR) |
| `system: crash` | Notificación en la UI + botón de restart |
| `system: reboot` | Indicador de reinicio en el canvas |

---

## 12. Variables de entorno

| Variable | Valor | Efecto |
|----------|-------|--------|
| `QEMU_ESP32_LIB` | ruta a `libqemu-xtensa.dll` | Fuerza ruta de DLL (override auto-detect) |
| `QEMU_ESP32_BINARY` | ruta a `qemu-system-xtensa.exe` | Fallback subprocess (sin DLL) |

Si `QEMU_ESP32_LIB` no está seteado, el sistema busca `libqemu-xtensa.dll` en la misma carpeta que `esp32_lib_bridge.py`.
