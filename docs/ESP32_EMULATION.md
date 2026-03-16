# ESP32 Emulation (Xtensa) — Documentación Técnica

> Estado: **Funcional** · Backend completo · Frontend completo
> Motor: **lcgamboa/qemu-8.1.3** · Plataforma: **arduino-esp32 2.0.17 (IDF 4.4.x)**
> Disponible en: **Windows** (`.dll`) · **Linux / Docker** (`.so`, incluido en imagen oficial)
> Aplica a: **ESP32, ESP32-S3** (arquitectura Xtensa LX6/LX7)

> **Nota sobre ESP32-C3:** Los boards ESP32-C3, XIAO ESP32-C3 y ESP32-C3 SuperMini usan la arquitectura **RISC-V RV32IMC** y tienen su propio emulador en el navegador. Ver → [RISCV_EMULATION.md](./RISCV_EMULATION.md)

---

## Índice

1. [Instalación rápida — Windows](#1-instalación-rápida--windows)
2. [Instalación rápida — Docker / Linux](#2-instalación-rápida--docker--linux)
3. [Arquitectura general](#3-arquitectura-general)
4. [Componentes del sistema](#4-componentes-del-sistema)
5. [Firmware — Requisitos para lcgamboa](#5-firmware--requisitos-para-lcgamboa)
6. [WiFi emulada](#6-wifi-emulada)
7. [I2C emulado](#7-i2c-emulado)
8. [RMT / NeoPixel (WS2812)](#8-rmt--neopixel-ws2812)
9. [LEDC / PWM](#9-ledc--pwm)
10. [Compilar la librería manualmente](#10-compilar-la-librería-manualmente)
11. [Tests](#11-tests)
12. [Frontend — Eventos implementados](#12-frontend--eventos-implementados)
13. [Limitaciones conocidas](#13-limitaciones-conocidas)
14. [Variables de entorno](#14-variables-de-entorno)

---

## 1. Instalación rápida — Windows

Esta sección cubre todo lo necesario para tener la emulación ESP32 funcionando desde cero en Windows.

### 1.1 Prerrequisitos de sistema

| Herramienta | Versión mínima | Para qué se usa |
|-------------|----------------|-----------------|
| Python | 3.11+ | Backend FastAPI |
| MSYS2 | cualquiera | Compilar la DLL de QEMU |
| arduino-cli | 1.x | Compilar sketches ESP32 |
| esptool | 4.x o 5.x | Crear imágenes flash de 4 MB |
| Git | 2.x | Clonar submodule qemu-lcgamboa |

### 1.2 Instalar MSYS2

Descarga e instala desde [msys2.org](https://www.msys2.org) o via winget:

```powershell
winget install MSYS2.MSYS2
```

Abre la terminal **MSYS2 MINGW64** y ejecuta:

```bash
pacman -Syu   # actualizar base

pacman -S \
  mingw-w64-x86_64-gcc \
  mingw-w64-x86_64-glib2 \
  mingw-w64-x86_64-libgcrypt \
  mingw-w64-x86_64-libslirp \
  mingw-w64-x86_64-pixman \
  mingw-w64-x86_64-ninja \
  mingw-w64-x86_64-meson \
  mingw-w64-x86_64-python \
  mingw-w64-x86_64-pkg-config \
  git diffutils
```

### 1.3 Instalar arduino-cli y el core ESP32 2.0.17

```bash
# Instalar arduino-cli (si no lo tienes)
winget install ArduinoSA.arduino-cli

# Verificar
arduino-cli version

# Añadir soporte ESP32
arduino-cli core update-index
arduino-cli core install esp32:esp32@2.0.17   # ← IMPORTANTE: 2.x, NO 3.x

# Verificar
arduino-cli core list   # debe mostrar esp32:esp32  2.0.17
```

> **¿Por qué 2.0.17 y no 3.x?** El WiFi emulado de lcgamboa desactiva la caché SPI flash
> periódicamente. En IDF 5.x (arduino-esp32 3.x) esto provoca un crash de caché cuando las
> interrupciones del core 0 intentan ejecutar código desde IROM. IDF 4.4.x es compatible.

### 1.4 Instalar esptool

```bash
pip install esptool
# Verificar
esptool version   # o: python -m esptool version
```

### 1.5 Compilar la DLL de QEMU (libqemu-xtensa.dll)

La DLL es el motor principal de la emulación. Hay que compilarla una vez desde el submodule `wokwi-libs/qemu-lcgamboa`.

```bash
# Asegurarse de tener el submodule
git submodule update --init wokwi-libs/qemu-lcgamboa

# En terminal MSYS2 MINGW64:
cd /e/Hardware/wokwi_clon/wokwi-libs/qemu-lcgamboa
bash build_libqemu-esp32-win.sh
# Genera: build/libqemu-xtensa.dll y build/libqemu-riscv32.dll
```

Copia la DLL al backend:

```bash
cp build/libqemu-xtensa.dll /e/Hardware/wokwi_clon/backend/app/services/
```

**Verificar que la DLL se creó:**
```bash
ls -lh backend/app/services/libqemu-xtensa.dll
# → debe ser ~40-50 MB
```

**Verificar exports:**
```bash
objdump -p backend/app/services/libqemu-xtensa.dll | grep -i "qemu_picsimlab\|qemu_init"
# → debe mostrar qemu_init, qemu_main_loop, qemu_picsimlab_register_callbacks, etc.
```

### 1.6 Obtener los ROM binaries del ESP32

La DLL necesita dos archivos ROM de Espressif para arrancar el ESP32. Deben colocarse en la misma carpeta que la DLL:

**Opción A — Desde esp-qemu (si está instalado):**
```bash
copy "C:\esp-qemu\qemu\share\qemu\esp32-v3-rom.bin" backend\app\services\
copy "C:\esp-qemu\qemu\share\qemu\esp32-v3-rom-app.bin" backend\app\services\
```

**Opción B — Desde el submodule lcgamboa (más fácil):**
```bash
cp wokwi-libs/qemu-lcgamboa/pc-bios/esp32-v3-rom.bin backend/app/services/
cp wokwi-libs/qemu-lcgamboa/pc-bios/esp32-v3-rom-app.bin backend/app/services/
```

**Verificar:**
```bash
ls -lh backend/app/services/esp32-v3-rom.bin
ls -lh backend/app/services/esp32-v3-rom-app.bin
# → ambos ~446 KB
```

### 1.7 Instalar dependencias Python del backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
```

### 1.8 Verificar instalación con los tests

```bash
# Desde la raíz del repo (con venv activado):
python -m pytest test/esp32/test_esp32_lib_bridge.py -v

# Resultado esperado: 28 passed en ~13 segundos
```

Si ves `28 passed` — la emulación está completamente funcional.

**Tests adicionales (Arduino ↔ ESP32 serial):**
```bash
python -m pytest test/esp32/test_arduino_esp32_integration.py -v
# Resultado esperado: 13 passed
```

### 1.9 Arrancar el backend con emulación ESP32

```bash
cd backend
venv\Scripts\activate
uvicorn app.main:app --reload --port 8001
```

El sistema detecta automáticamente la DLL. Verifica en los logs:
```
INFO: libqemu-xtensa.dll found at backend/app/services/libqemu-xtensa.dll
INFO: EspLibManager: lib mode active (GPIO, ADC, UART, WiFi, I2C, SPI, RMT, LEDC)
```

Si no aparece, verifica con:
```bash
python -c "
import sys; sys.path.insert(0,'backend')
from app.services.esp32_lib_manager import esp_lib_manager
print('lib disponible:', esp_lib_manager.is_available())
"
```

### 1.10 Compilar un sketch propio para ESP32

```bash
# Compilar con DIO flash mode (requerido por QEMU lcgamboa):
arduino-cli compile \
  --fqbn esp32:esp32:esp32:FlashMode=dio \
  --output-dir build/ \
  mi_sketch/

# Crear imagen 4 MB completa (obligatorio para QEMU):
esptool --chip esp32 merge_bin \
  --fill-flash-size 4MB \
  -o firmware.merged.bin \
  --flash_mode dio \
  --flash_size 4MB \
  0x1000  build/mi_sketch.ino.bootloader.bin \
  0x8000  build/mi_sketch.ino.partitions.bin \
  0x10000 build/mi_sketch.ino.bin
```

El archivo `firmware.merged.bin` es el que se carga en la emulación.

---

## 2. Instalación rápida — Docker / Linux

**La emulación ESP32 completa está incluida en la imagen Docker oficial.** No requiere ninguna instalación adicional — la `libqemu-xtensa.so` se compila automáticamente durante el build de la imagen a partir del fork lcgamboa.

### 2.1 Usar la imagen precompilada (recomendado)

```bash
docker run -d \
  --name velxio \
  -p 3080:80 \
  -v $(pwd)/data:/app/data \
  -e SECRET_KEY=tu-secreto \
  ghcr.io/davidmonterocrespo24/velxio:master
```

La emulación ESP32 con GPIO completo está activa automáticamente. No se necesita ninguna variable de entorno adicional.

### 2.2 Build local de la imagen

```bash
git clone https://github.com/davidmonterocrespo24/velxio.git
cd velxio
docker build -f Dockerfile.standalone -t velxio .
docker run -d -p 3080:80 -e SECRET_KEY=secreto velxio
```

> **Nota de build time:** La compilación de QEMU tarda 15-30 minutos la primera vez.
> Los builds posteriores usan la capa Docker cacheada — son instantáneos mientras no
> cambie el source de lcgamboa.

### 2.3 Verificar emulación ESP32 en el container

```bash
# Verificar que .so y ROMs están presentes
docker exec <container_id> ls -lh /app/lib/

# Verificar que ctypes puede cargar la .so
docker exec <container_id> python3 -c \
  "import ctypes; ctypes.CDLL('/app/lib/libqemu-xtensa.so'); print('OK')"

# Verificar que el manager la detecta
docker exec <container_id> python3 -c \
  "import sys; sys.path.insert(0,'/app')
from app.services.esp32_lib_manager import esp_lib_manager
print('ESP32 lib disponible:', esp_lib_manager.is_available())"
```

### 2.4 Linux (sin Docker)

Si corres el backend directamente en Linux:

```bash
# 1. Instalar dependencias de runtime
sudo apt-get install -y libglib2.0-0 libgcrypt20 libslirp0 libpixman-1-0

# 2. Compilar la .so (requiere herramientas de build)
sudo apt-get install -y git python3-pip ninja-build pkg-config flex bison \
    gcc g++ make libglib2.0-dev libgcrypt20-dev libslirp-dev libpixman-1-dev libfdt-dev
pip3 install meson

git clone --depth=1 --branch picsimlab-esp32 \
    https://github.com/lcgamboa/qemu /tmp/qemu-lcgamboa
cd /tmp/qemu-lcgamboa
bash build_libqemu-esp32.sh
# → build/libqemu-xtensa.so

# 3. Copiar .so y ROMs junto al módulo Python
cp build/libqemu-xtensa.so /ruta/al/proyecto/backend/app/services/
cp pc-bios/esp32-v3-rom.bin /ruta/al/proyecto/backend/app/services/
cp pc-bios/esp32-v3-rom-app.bin /ruta/al/proyecto/backend/app/services/

# 4. Arrancar backend (auto-detecta la .so)
cd /ruta/al/proyecto/backend
uvicorn app.main:app --reload --port 8001
```

---

## 3. Arquitectura general

```
Usuario (browser)
  └── WebSocket (/ws/{client_id})
        └── simulation.py  (FastAPI router)
              ├── EspLibManager          ← backend con .so/.dll (GPIO, WiFi, I2C, SPI, RMT…)
              └── EspQemuManager         ← fallback solo-UART via subprocess
                    │
              [QEMU_ESP32_LIB=libqemu-xtensa.so|.dll]
                    │
              Esp32LibBridge (ctypes)
                    │
              libqemu-xtensa.so/.dll  ←  lcgamboa fork de QEMU 8.1.3
                    │
              Machine: esp32-picsimlab
                    │
         ┌──────────┴──────────┐
     CPU Xtensa LX6      periféricos emulados
     (dual-core)    GPIO · ADC · UART · I2C · SPI
                    RMT · LEDC · Timer · WiFi · Flash
```

El sistema selecciona backend automáticamente:
- **lib disponible** → `EspLibManager` (GPIO completo + todos los periféricos)
- **lib ausente** → `EspQemuManager` (solo UART serial via TCP, subprocess QEMU)

Detección automática:
| Plataforma | Lib buscada | Fuente |
|------------|-------------|--------|
| Docker / Linux | `/app/lib/libqemu-xtensa.so` | Compilada en el Dockerfile |
| Windows (desarrollo) | `backend/app/services/libqemu-xtensa.dll` | Compilada con MSYS2 |
| Custom | `$QEMU_ESP32_LIB` | Variable de entorno |

---

## 4. Componentes del sistema

### 4.1 `libqemu-xtensa.so` / `libqemu-xtensa.dll`

Compilada desde el fork [lcgamboa/qemu](https://github.com/lcgamboa/qemu) rama `picsimlab-esp32`.

**Dependencias en runtime:**

*Windows (resueltas automáticamente desde `C:\msys64\mingw64\bin\`):*
```
libglib-2.0-0.dll, libgcrypt-20.dll, libslirp-0.dll,
libgpg-error-0.dll, libintl-8.dll, libpcre2-8-0.dll  (+~15 DLLs MinGW64)
```

*Linux / Docker (paquetes del sistema):*
```
libglib2.0-0, libgcrypt20, libslirp0, libpixman-1-0
```

**ROM binaries requeridas** (en la misma carpeta que la lib):
```
# Windows (backend/app/services/):
  libqemu-xtensa.dll        ← motor principal (no en git — 43 MB)
  esp32-v3-rom.bin          ← ROM de boot del ESP32 (no en git — 446 KB)
  esp32-v3-rom-app.bin      ← ROM de aplicación  (no en git — 446 KB)

# Docker (/app/lib/):
  libqemu-xtensa.so         ← compilada en Stage 0 del Dockerfile
  libqemu-riscv32.so        ← ESP32-C3 (RISC-V)
  esp32-v3-rom.bin          ← copiada de pc-bios/ del repo lcgamboa
  esp32-v3-rom-app.bin
```

> En Windows estos archivos están en `.gitignore` por su tamaño. Cada desarrollador los genera localmente.
> En Docker se incluyen automáticamente en la imagen.

**Exports de la librería:**
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

### 4.2 GPIO Pinmap

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

### 4.3 `Esp32LibBridge` (Python ctypes)

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
```

**Threading crítico:**
`qemu_init()` y `qemu_main_loop()` **deben correr en el mismo thread** (BQL — Big QEMU Lock es thread-local). El bridge los ejecuta en un único daemon thread:

```python
# Correcto:
def _qemu_thread():
    lib.qemu_init(argc, argv, None)   # init
    lib.qemu_main_loop()              # bloquea indefinidamente

# Incorrecto:
lib.qemu_init(...)         # en thread A
lib.qemu_main_loop()       # en thread B  ← crash: "qemu_mutex_unlock_iothread assertion failed"
```

---

### 4.4 `EspLibManager` (Python)

Archivo: `backend/app/services/esp32_lib_manager.py`

Convierte callbacks de hardware en **eventos WebSocket** para el frontend:

| Evento emitido | Datos | Cuándo |
|----------------|-------|--------|
| `system` | `{event: 'booting'│'booted'│'crash'│'reboot', ...}` | Ciclo de vida |
| `serial_output` | `{data: str, uart: 0│1│2}` | UART TX del ESP32 |
| `gpio_change` | `{pin: int, state: 0│1}` | GPIO output cambia |
| `gpio_dir` | `{pin: int, dir: 0│1}` | GPIO cambia dirección |
| `i2c_event` | `{bus, addr, event, response}` | Transacción I2C |
| `spi_event` | `{bus, event, response}` | Transacción SPI |
| `rmt_event` | `{channel, config0, value, level0, dur0, level1, dur1}` | Pulso RMT |
| `ws2812_update` | `{channel, pixels: [[r,g,b],...]}` | Frame NeoPixel completo |
| `ledc_update` | `{channel, duty, duty_pct}` | PWM duty cycle |
| `error` | `{message: str}` | Error de boot |

**Detección de crash y reboot:**
```python
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

### 4.5 `simulation.py` — Mensajes WebSocket

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

## 5. Firmware — Requisitos para lcgamboa

### 5.1 Versión de plataforma requerida

**✅ Usar: arduino-esp32 2.x (IDF 4.4.x)**
**❌ No usar: arduino-esp32 3.x (IDF 5.x)**

```bash
arduino-cli core install esp32:esp32@2.0.17
```

**Por qué:** El WiFi emulado de lcgamboa (core 1) desactiva la caché SPI flash periódicamente. En IDF 5.x esto provoca un crash cuando las interrupciones del core 0 intentan ejecutar código desde IROM (flash cache). En IDF 4.4.x el comportamiento de la caché es diferente y compatible.

**Mensaje de crash (IDF 5.x):**
```
Guru Meditation Error: Core  / panic'ed (Cache error).
Cache disabled but cached memory region accessed
EXCCAUSE: 0x00000007
```

### 5.2 Imagen de flash

La imagen debe ser un archivo binario completo de **4 MB** (formato merged flash):

```bash
# Compilar con DIO flash mode:
arduino-cli compile --fqbn esp32:esp32:esp32:FlashMode=dio \
  --output-dir build/ sketch/

# Crear imagen 4MB completa (¡obligatorio! QEMU requiere 2/4/8/16 MB exactos):
esptool --chip esp32 merge_bin \
  --fill-flash-size 4MB \
  -o firmware.merged.bin \
  --flash_mode dio \
  --flash_size 4MB \
  0x1000  build/sketch.ino.bootloader.bin \
  0x8000  build/sketch.ino.partitions.bin \
  0x10000 build/sketch.ino.bin
```

El backend (`arduino_cli.py`) fuerza `FlashMode=dio` automáticamente para todos los targets `esp32:*`.

### 5.3 Sketch compatible con lcgamboa (ejemplo mínimo IRAM-safe)

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

## 6. WiFi emulada

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
- La IP del "router" virtual es `10.0.2.2` (host)
- El ESP32 emulado es accesible en `localhost:PORT` via port forwarding SLIRP

---

## 7. I2C emulado

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
```

Desde WebSocket:
```json
{"type": "esp32_i2c_response", "data": {"addr": 72, "response": 75}}
```

---

## 8. RMT / NeoPixel (WS2812)

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
    "pixels": [[255, 0, 0], [0, 255, 0]]
  }
}
```

---

## 9. LEDC / PWM

`qemu_picsimlab_get_internals(0)` retorna un puntero a un array de 16 `uint32_t` con el duty cycle de cada canal LEDC. Llamar periódicamente (cada ~50 ms):

```python
await esp_lib_manager.poll_ledc(client_id)
# Emite: {"type": "ledc_update", "data": {"channel": 0, "duty": 4096, "duty_pct": 50.0}}
```

El duty máximo típico es 8192 (timer de 13 bits). Para brillo de LED: `duty_pct / 100`.

---

## 10. Compilar la librería manualmente

### 10.1 Windows (MSYS2 MINGW64)

El script `build_libqemu-esp32-win.sh` en `wokwi-libs/qemu-lcgamboa/` automatiza el proceso:

```bash
# En MSYS2 MINGW64:
cd wokwi-libs/qemu-lcgamboa
bash build_libqemu-esp32-win.sh
# Genera: build/libqemu-xtensa.dll y build/libqemu-riscv32.dll
```

El script configura QEMU con `--extra-cflags=-fPIC` (necesario para Windows/PE con ASLR), compila el binario completo y luego relinks eliminando `softmmu_main.c.obj` (que contiene `main()`):

```bash
cc -m64 -mcx16 -shared \
   -Wl,--export-all-symbols \
   -Wl,--allow-multiple-definition \
   -o libqemu-xtensa.dll \
   @dll_link.rsp      # todos los .obj excepto softmmu_main
```

### 10.2 Linux

El script `build_libqemu-esp32.sh` produce `.so`:

```bash
cd wokwi-libs/qemu-lcgamboa
bash build_libqemu-esp32.sh
# Genera: build/libqemu-xtensa.so y build/libqemu-riscv32.so
```

### 10.3 Verificar exports (ambas plataformas)

```bash
# Linux:
nm -D build/libqemu-xtensa.so | grep -i "qemu_picsimlab\|qemu_init\|qemu_main"

# Windows:
objdump -p build/libqemu-xtensa.dll | grep -i "qemu_picsimlab\|qemu_init"

# Debe mostrar:
#   qemu_init, qemu_main_loop, qemu_cleanup
#   qemu_picsimlab_register_callbacks
#   qemu_picsimlab_set_pin, qemu_picsimlab_set_apin
#   qemu_picsimlab_uart_receive
#   qemu_picsimlab_get_internals, qemu_picsimlab_get_TIOCM
```

### 10.4 Parche requerido en Windows (symlink-install-tree.py)

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

## 11. Tests

### 11.1 Test suite principal (28 tests)

Archivo: `test/esp32/test_esp32_lib_bridge.py`

```bash
python -m pytest test/esp32/test_esp32_lib_bridge.py -v
# Resultado esperado: 28 passed en ~13 segundos
```

| Grupo | Tests | Qué verifica |
|-------|-------|--------------|
| `TestDllExists` | 5 | Rutas de lib, ROM binaries, dependencias de plataforma |
| `TestDllLoads` | 3 | Carga de lib, symbols exportados |
| `TestPinmap` | 3 | Estructura del pinmap, GPIO2 en slot 3 |
| `TestManagerAvailability` | 2 | `is_available()`, API surface |
| `TestEsp32LibIntegration` | 15 | QEMU real con firmware blink: boot, UART, GPIO, ADC, SPI, I2C |

### 11.2 Test integración Arduino ↔ ESP32 (13 tests)

Archivo: `test/esp32/test_arduino_esp32_integration.py`

Simula comunicación serial completa entre un Arduino Uno (emulado en Python) y el ESP32 (QEMU lcgamboa). El "Arduino" envía comandos `LED_ON`/`LED_OFF`/`PING` al ESP32 y verifica respuestas + cambios GPIO.

```bash
python -m pytest test/esp32/test_arduino_esp32_integration.py -v
# Resultado esperado: 13 passed en ~30 segundos
```

| Test | Qué verifica |
|------|-------------|
| `test_01_esp32_boots_ready` | ESP32 arranca y envía "READY" por UART |
| `test_02_ping_pong` | Arduino→"PING", ESP32→"PONG" |
| `test_03_led_on_command` | LED_ON → GPIO2=HIGH + "OK:ON" |
| `test_04_led_off_command` | LED_OFF → GPIO2=LOW + "OK:OFF" |
| `test_05_toggle_five_times` | 5 ciclos ON/OFF → ≥10 transiciones GPIO2 |
| `test_06_gpio_sequence` | Secuencia correcta: ON→OFF→ON→OFF |
| `test_07_unknown_cmd_ignored` | Comando desconocido no crashea el ESP32 |
| `test_08_rapid_commands` | 20 comandos en burst → todas las respuestas llegan |

**Firmware de test:** `test/esp32-emulator/binaries_lcgamboa/serial_led.ino.merged.bin`
Sketch fuente: `test/esp32-emulator/sketches/serial_led/serial_led.ino`

### 11.3 Omitir tests de integración (solo unitarios)

```bash
SKIP_LIB_INTEGRATION=1 python -m pytest test/esp32/ -v
```

### 11.4 Recompilar el firmware de test

Si necesitas recompilar los binarios de test:

```bash
# Blink (firmware IRAM-safe para test de GPIO):
arduino-cli compile \
  --fqbn esp32:esp32:esp32:FlashMode=dio \
  --output-dir test/esp32-emulator/out_blink \
  test/esp32-emulator/sketches/blink_lcgamboa

esptool --chip esp32 merge_bin --fill-flash-size 4MB \
  -o test/esp32-emulator/binaries_lcgamboa/blink_lcgamboa.ino.merged.bin \
  --flash_mode dio --flash_size 4MB \
  0x1000  test/esp32-emulator/out_blink/blink_lcgamboa.ino.bootloader.bin \
  0x8000  test/esp32-emulator/out_blink/blink_lcgamboa.ino.partitions.bin \
  0x10000 test/esp32-emulator/out_blink/blink_lcgamboa.ino.bin

# Serial LED (firmware para test Arduino↔ESP32):
arduino-cli compile \
  --fqbn esp32:esp32:esp32:FlashMode=dio \
  --output-dir test/esp32-emulator/out_serial_led \
  test/esp32-emulator/sketches/serial_led

esptool --chip esp32 merge_bin --fill-flash-size 4MB \
  -o test/esp32-emulator/binaries_lcgamboa/serial_led.ino.merged.bin \
  --flash_mode dio --flash_size 4MB \
  0x1000  test/esp32-emulator/out_serial_led/serial_led.ino.bootloader.bin \
  0x8000  test/esp32-emulator/out_serial_led/serial_led.ino.partitions.bin \
  0x10000 test/esp32-emulator/out_serial_led/serial_led.ino.bin
```

---

## 12. Frontend — Eventos implementados

Todos los eventos del backend están conectados al frontend:

| Evento | Componente | Estado |
|--------|-----------|--------|
| `gpio_change` | `PinManager.triggerPinChange()` → LEDs/componentes conectados | ✅ Implementado |
| `ledc_update` | `PinManager.updatePwm()` → brillo variable en `LED.tsx` | ✅ Implementado |
| `ws2812_update` | `NeoPixel.tsx` — strip de LEDs RGB con canvas | ✅ Implementado |
| `gpio_dir` | Callback `onPinDir` en `Esp32Bridge.ts` | ✅ Implementado |
| `i2c_event` | Callback `onI2cEvent` en `Esp32Bridge.ts` | ✅ Implementado |
| `spi_event` | Callback `onSpiEvent` en `Esp32Bridge.ts` | ✅ Implementado |
| `system: crash` | Banner rojo en `SimulatorCanvas.tsx` con botón Dismiss | ✅ Implementado |
| `system: reboot` | `onSystemEvent` en `Esp32Bridge.ts` | ✅ Implementado |

**Métodos de envío disponibles en `Esp32Bridge` (frontend → backend):**
```typescript
bridge.sendSerialBytes(bytes, uart?)   // Enviar datos serial al ESP32
bridge.sendPinEvent(gpioPin, state)    // Simular input externo en un GPIO
bridge.setAdc(channel, millivolts)     // Setear voltaje ADC (0-3300 mV)
bridge.setI2cResponse(addr, response)  // Respuesta de dispositivo I2C
bridge.setSpiResponse(response)        // Byte MISO de dispositivo SPI
```

**Uso del componente NeoPixel:**
```tsx
// El id debe seguir el patrón ws2812-{boardId}-{channel}
// para que el store pueda enviarle los pixels via CustomEvent
<NeoPixel
  id="ws2812-esp32-0"
  count={8}
  x={200}
  y={300}
  direction="horizontal"
/>
```

---

## 13. Limitaciones conocidas (no solucionables sin modificar QEMU)

| Limitación | Causa | Workaround |
|------------|-------|------------|
| **Una sola instancia ESP32 por proceso** | QEMU usa estado global en variables estáticas | Lanzar múltiples procesos Python |
| **WiFi solo con SSIDs hardcoded** | lcgamboa codifica "PICSimLabWifi" y "Espressif" en C | Modificar y recompilar la lib |
| **Sin BLE / Bluetooth Classic** | No implementado en lcgamboa | No disponible |
| **Sin touch capacitivo** | `touchRead()` no tiene callback en picsimlab | No disponible |
| **Sin DAC** | GPIO25/GPIO26 analógico no expuesto por picsimlab | No disponible |
| **Flash fija en 4MB** | Hardcoded en la machine esp32-picsimlab | Recompilar lib |
| **arduino-esp32 3.x causa crash** | IDF 5.x maneja caché diferente al WiFi emulado | Usar 2.x (IDF 4.4.x) |

---

## 14. Variables de entorno

| Variable | Valor de ejemplo | Efecto |
|----------|-----------------|--------|
| `QEMU_ESP32_LIB` | `/app/lib/libqemu-xtensa.so` | Fuerza ruta de lib (override auto-detect) |
| `QEMU_ESP32_BINARY` | `/usr/bin/qemu-system-xtensa` | Fallback subprocess (sin lib) |
| `SKIP_LIB_INTEGRATION` | `1` | Omite tests de integración QEMU en pytest |

**Auto-detección por plataforma:**

| Plataforma | Lib buscada automáticamente |
|------------|----------------------------|
| Docker / Linux | `/app/lib/libqemu-xtensa.so` (via `QEMU_ESP32_LIB`) |
| Windows | `backend/app/services/libqemu-xtensa.dll` |
| Custom | `$QEMU_ESP32_LIB` (si está seteado, tiene prioridad) |

**Ejemplos de arranque:**

```bash
# Docker — todo automático, no requiere variables extra:
docker run -d -p 3080:80 -e SECRET_KEY=secreto ghcr.io/davidmonterocrespo24/velxio:master

# Windows con lib (emulación completa GPIO + WiFi + ADC + I2C + SPI + RMT + LEDC):
cd backend && venv\Scripts\activate
uvicorn app.main:app --reload --port 8001

# Linux con lib en ruta custom:
QEMU_ESP32_LIB=/opt/velxio/libqemu-xtensa.so uvicorn app.main:app --port 8001

# Sin lib (fallback: solo UART serial via subprocess QEMU):
QEMU_ESP32_BINARY=/usr/bin/qemu-system-xtensa uvicorn app.main:app --port 8001
```
