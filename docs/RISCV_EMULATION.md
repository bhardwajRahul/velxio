# RISC-V Emulation (ESP32-C3 / XIAO-C3 / C3 SuperMini)

> Estado: **Funcional** · Emulación en el navegador · Sin dependencias de backend
> Motor: **RiscVCore (RV32IMC)** — implementado en TypeScript
> Plataforma: **ESP32-C3 @ 160 MHz** — arquitectura RISC-V de 32 bits

---

## Índice

1. [Visión general](#1-visión-general)
2. [Boards soportadas](#2-boards-soportadas)
3. [Arquitectura del emulador](#3-arquitectura-del-emulador)
4. [Memoria y periféricos emulados](#4-memoria-y-periféricos-emulados)
5. [Flujo completo: compilar y ejecutar](#5-flujo-completo-compilar-y-ejecutar)
6. [Formato de imagen ESP32](#6-formato-de-imagen-esp32)
7. [ISA soportada — RV32IMC](#7-isa-soportada--rv32imc)
8. [GPIO](#8-gpio)
9. [UART0 — Serial Monitor](#9-uart0--serial-monitor)
10. [Limitaciones](#10-limitaciones)
11. [Tests](#11-tests)
12. [Diferencias vs emulación Xtensa (ESP32 / ESP32-S3)](#12-diferencias-vs-emulación-xtensa-esp32--esp32-s3)
13. [Archivos clave](#13-archivos-clave)

---

## 1. Visión general

Los boards basados en **ESP32-C3** usan el procesador **ESP32-C3** de Espressif, que implementa la arquitectura **RISC-V RV32IMC** (32 bits, Multiply, Compressed instructions). A diferencia del ESP32 y ESP32-S3 (Xtensa LX6/LX7), el C3 **no requiere QEMU ni backend** para emularse.

### Comparación de motores de emulación

| Board | CPU | Motor |
|-------|-----|-------|
| ESP32, ESP32-S3 | Xtensa LX6/LX7 | QEMU lcgamboa (backend WebSocket) |
| **ESP32-C3, XIAO-C3, C3 SuperMini** | **RV32IMC @ 160 MHz** | **RiscVCore.ts (navegador, sin backend)** |
| Arduino Uno/Nano/Mega | AVR ATmega | avr8js (navegador) |
| Raspberry Pi Pico | RP2040 | rp2040js (navegador) |

### Ventajas del emulador JS

- **Sin dependencias de red** — funciona offline, sin conexión WebSocket al backend
- **Arranque instantáneo** — no hay proceso QEMU que arrancar (0 ms de latencia)
- **Testable con Vitest** — el mismo código TypeScript que se ejecuta en producción se puede probar en CI
- **Multiplataforma** — funciona igual en Windows, macOS, Linux y Docker

---

## 2. Boards soportadas

| Board | FQBN arduino-cli | LED built-in |
|-------|-----------------|--------------|
| ESP32-C3 DevKit | `esp32:esp32:esp32c3` | GPIO 8 |
| Seeed XIAO ESP32-C3 | `esp32:esp32:XIAO_ESP32C3` | GPIO 10 (active-low) |
| ESP32-C3 SuperMini | `esp32:esp32:esp32c3` | GPIO 8 |

---

## 3. Arquitectura del emulador

```
Arduino Sketch (.ino)
        │
        ▼ arduino-cli (backend)
  sketch.ino.bin  ←  ESP32 image format (segmentos IROM/DRAM/IRAM)
        │
        ▼ base64 → frontend
  compileBoardProgram(boardId, base64)
        │
        ▼ Esp32C3Simulator.loadFlashImage(base64)
  parseMergedFlashImage()  ←  lee segmentos de la imagen 4MB
        │
        ├── IROM segment → flash buffer  (0x42000000)
        ├── DROM segment → flash buffer  (0x3C000000, alias)
        ├── DRAM segment → dram buffer   (0x3FC80000)
        └── IRAM segment → iram buffer   (0x4037C000)
        │
        ▼ core.reset(entryPoint)
  RiscVCore.step()  ←  requestAnimationFrame @ 60 FPS
        │             2.666.667 ciclos/frame (160 MHz ÷ 60)
        ├── MMIO GPIO_W1TS/W1TC → onPinChangeWithTime → componentes visuales
        └── MMIO UART0 FIFO    → onSerialData → Serial Monitor
```

### Clases principales

| Clase | Archivo | Responsabilidad |
|-------|---------|----------------|
| `RiscVCore` | `simulation/RiscVCore.ts` | Decodificador/ejecutor RV32IMC, MMIO genérico |
| `Esp32C3Simulator` | `simulation/Esp32C3Simulator.ts` | Mapa de memoria ESP32-C3, GPIO, UART0, ciclo RAF |
| `parseMergedFlashImage` | `utils/esp32ImageParser.ts` | Parseo formato imagen ESP32 (segmentos, entry point) |

---

## 4. Memoria y periféricos emulados

### Mapa de memoria

| Región | Dirección base | Tamaño | Descripción |
|--------|---------------|--------|-------------|
| Flash IROM | `0x42000000` | 4 MB | Código ejecutable (buffer principal del core) |
| Flash DROM | `0x3C000000` | 4 MB | Datos de solo lectura (alias del mismo buffer) |
| DRAM | `0x3FC80000` | 384 KB | RAM de datos (stack, variables globales) |
| IRAM | `0x4037C000` | 384 KB | RAM de instrucciones (ISR, código time-critical) |
| UART0 | `0x60000000` | 1 KB | Serial port 0 |
| GPIO | `0x60004000` | 512 B | Registros GPIO |

### GPIO — registros implementados

| Registro | Offset | Función |
|----------|--------|---------|
| `GPIO_OUT_REG` | `+0x04` | Leer/escribir estado de salida de todos los pines |
| `GPIO_OUT_W1TS_REG` | `+0x08` | **Set bits** — poner pines a HIGH (write-only) |
| `GPIO_OUT_W1TC_REG` | `+0x0C` | **Clear bits** — poner pines a LOW (write-only) |
| `GPIO_IN_REG` | `+0x3C` | Leer estado de entrada de pines |
| `GPIO_ENABLE_REG` | `+0x20` | Dirección de pines (siempre devuelve `0xFF`) |

Cubre **GPIO 0–21** (todos los disponibles en ESP32-C3).

### UART0 — registros implementados

| Registro | Offset | Función |
|----------|--------|---------|
| `UART_FIFO_REG` | `+0x00` | Escribir byte TX / leer byte RX |
| `UART_STATUS_REG` | `+0x1C` | Estado FIFO (siempre devuelve `0` = listo) |

Lectura de byte de RX disponible para simular input desde Serial Monitor.

### Periféricos NO emulados (retornan 0 en lectura)

- Interrupt Matrix (`0x600C2000`)
- System / Clock (`0x600C0000`, `0x60008000`)
- Cache controller (`0x600C4000`)
- Timer Group 0/1
- SPI flash controller
- BLE / WiFi MAC
- ADC / DAC

> Estos periféricos retornan `0` por defecto. El código que los requiere puede no funcionar correctamente (ver [Limitaciones](#10-limitaciones)).

---

## 5. Flujo completo: compilar y ejecutar

### 5.1 Compilar el sketch

```bash
# arduino-cli compila para ESP32-C3:
arduino-cli compile \
  --fqbn esp32:esp32:esp32c3 \
  --output-dir build/ \
  mi_sketch/

# El backend crea automáticamente la imagen fusionada (merged):
#   build/mi_sketch.ino.bootloader.bin  → 0x01000
#   build/mi_sketch.ino.partitions.bin  → 0x08000
#   build/mi_sketch.ino.bin             → 0x10000 (app)
#   → merged: sketch.ino.merged.bin (4 MB)
```

El backend de Velxio produce esta imagen automáticamente y la envía al frontend como base64.

### 5.2 Sketch mínimo para ESP32-C3

```cpp
// LED en GPIO 8 (ESP32-C3 DevKit)
#define LED_PIN 8

void setup() {
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(115200);
  Serial.println("ESP32-C3 iniciado");
}

void loop() {
  digitalWrite(LED_PIN, HIGH);
  Serial.println("LED ON");
  delay(500);
  digitalWrite(LED_PIN, LOW);
  Serial.println("LED OFF");
  delay(500);
}
```

### 5.3 Sketch bare-metal (para tests de emulación directos)

Para verificar la emulación sin el framework Arduino, se puede compilar con el toolchain RISC-V directamente:

```c
/* blink.c — bare-metal, sin ESP-IDF */
#define GPIO_W1TS  (*(volatile unsigned int *)0x60004008u)
#define GPIO_W1TC  (*(volatile unsigned int *)0x6000400Cu)
#define LED_BIT    (1u << 8)

static void delay(int n) { for (volatile int i = 0; i < n; i++); }

void _start(void) {
  while (1) {
    GPIO_W1TS = LED_BIT;   /* LED ON  */
    delay(500);
    GPIO_W1TC = LED_BIT;   /* LED OFF */
    delay(500);
  }
}
```

Compilar con el toolchain bundled en arduino-cli:

```bash
# Toolchain instalado con: arduino-cli core install esp32:esp32
TOOLCHAIN="$LOCALAPPDATA/Arduino15/packages/esp32/tools/riscv32-esp-elf-gcc/esp-2021r2-patch5-8.4.0/bin"

"$TOOLCHAIN/riscv32-esp-elf-gcc" \
  -march=rv32imc -mabi=ilp32 -Os -nostdlib -nostartfiles \
  -T link.ld -o blink.elf blink.c

"$TOOLCHAIN/riscv32-esp-elf-objcopy" -O binary blink.elf blink.bin
```

Ver script completo: `frontend/src/__tests__/fixtures/esp32c3-blink/build.sh`

---

## 6. Formato de imagen ESP32

El backend produce una imagen fusionada de **4 MB**:

```
Offset 0x00000: 0xFF (vacío)
Offset 0x01000: bootloader   (imagen ESP32 format, magic 0xE9)
Offset 0x08000: partition table
Offset 0x10000: app binary   (imagen ESP32 format, magic 0xE9) ← parseamos aquí
```

### Cabecera de imagen ESP32 (24 bytes)

```
+0x00  magic (0xE9)
+0x01  segment_count
+0x02  spi_mode
+0x03  spi_speed_size
+0x04  entry_addr       ← uint32 LE — PC de entrada del firmware
+0x08  extended fields (16 bytes)
```

### Cabecera de segmento (8 bytes)

```
+0x00  load_addr   ← dirección virtual destino (e.g. 0x42000000)
+0x04  data_len
+0x08  data[data_len]
```

El parser `parseMergedFlashImage()` en `utils/esp32ImageParser.ts` extrae todos los segmentos y el entry point, que se usa para el reset del core (`core.reset(entryPoint)`).

---

## 7. ISA soportada — RV32IMC

`RiscVCore.ts` implementa las tres extensiones necesarias para ejecutar código compilado para ESP32-C3:

### RV32I — Base integer (40 instrucciones)

Incluye: LUI, AUIPC, JAL, JALR, BEQ/BNE/BLT/BGE/BLTU/BGEU, LB/LH/LW/LBU/LHU, SB/SH/SW, ADDI/SLTI/SLTIU/XORI/ORI/ANDI/SLLI/SRLI/SRAI, ADD/SUB/SLL/SLT/SLTU/XOR/SRL/SRA/OR/AND, FENCE, ECALL/EBREAK, CSR (lectura devuelve 0)

### RV32M — Multiplicación y división (8 instrucciones)

| Instrucción | Operación |
|-------------|-----------|
| `MUL` | Producto entero (32 bits bajos) |
| `MULH` | Producto con signo (32 bits altos) |
| `MULHSU` | Producto mixto firmado×sin firma (altos) |
| `MULHU` | Producto sin firma (32 bits altos) |
| `DIV` | División entera con signo |
| `DIVU` | División entera sin firma |
| `REM` | Resto con signo |
| `REMU` | Resto sin firma |

### RV32C — Instrucciones comprimidas (16 bits)

Todas las instrucciones de 16 bits del estándar C son soportadas. Se detectan por `(halfword & 3) !== 3` y se descomprimen a su equivalente RV32I antes de ejecutar. Esto es crítico: el compilador GCC para ESP32-C3 genera intensamente instrucciones C (`c.addi`, `c.sw`, `c.lw`, `c.j`, `c.beqz`, `c.bnez`, etc.) que representan ~30-40% de todas las instrucciones en el binario final.

---

## 8. GPIO

El manejo de GPIO sigue el modelo de registros W1TS/W1TC del ESP32-C3:

```typescript
// Sketch Arduino:
digitalWrite(8, HIGH);  // → internamente escribe 1<<8 a GPIO_OUT_W1TS_REG

// En el simulador:
// SW x10, 0(x12)  donde x10=256 (1<<8), x12=0x60004008 (W1TS)
// → escribe 4 bytes a 0x60004008..0x6000400B
// → byteIdx=1 (offset 0x09): val=0x01, shift=8 → gpioOut |= 0x100
// → changed = prev ^ gpioOut ≠ 0 → dispara onPinChangeWithTime(8, true, timeMs)
```

El callback `onPinChangeWithTime(pin, state, timeMs)` es el punto de integración con los componentes visuales. `timeMs` es el tiempo simulado en milisegundos (calculado como `core.cycles / CPU_HZ * 1000`).

---

## 9. UART0 — Serial Monitor

Cualquier byte escrito a `UART0_FIFO_REG` (0x60000000) llama al callback `onSerialData(char)`:

```cpp
// Sketch Arduino:
Serial.println("Hola!");
// → Arduino framework escribe los bytes de "Hola!\r\n" a UART0_FIFO_REG
// → simulador llama onSerialData("H"), onSerialData("o"), ...
// → Serial Monitor muestra "Hola!"
```

Para enviar datos al sketch desde el Serial Monitor:

```typescript
sim.serialWrite("COMANDO\n");
// → bytes se añaden a rxFifo
// → lectura de UART0_FIFO_REG dequeue un byte del rxFifo
```

---

## 10. Limitaciones

### Framework ESP-IDF / Arduino

El framework Arduino para ESP32-C3 (basado en ESP-IDF 4.4.x) tiene una secuencia de inicialización compleja que accede a periféricos no emulados:

| Periférico | Por qué lo accede ESP-IDF | Efecto en emulador |
|------------|--------------------------|-------------------|
| Cache controller | Configura MMU para mapeo flash/DRAM | Lee 0, puede que no loop |
| Interrupt Matrix | Registra vectores ISR | Sin efecto (silenciado) |
| System registers | Configura PLLs y clocks | Lee 0 (asume velocidad por defecto) |
| FreeRTOS tick timer | Timer 0 → interrupción periódica | Sin interrupción = tareas no se planifican |

Como resultado, un sketch Arduino compilado con el framework completo puede ejecutarse parcialmente — el código anterior a la inicialización de FreeRTOS puede funcionar, pero `setup()` y `loop()` dependen de que FreeRTOS esté corriendo.

**Escenarios que SÍ funcionan:**

- Código bare-metal (sin framework, acceso directo a GPIO MMIO)
- Fragmentos de código que no usen FreeRTOS (`delay()`, `millis()`, `digitalWrite()` requieren FreeRTOS)
- Programas de prueba de ISA (operaciones aritméticas, branches, loads/stores a DRAM)

**Roadmap para soporte completo:**

1. Stub del cache controller (devolver valores que indiquen "cache ya configurada")
2. Stub del interrupt matrix (aceptar writes, ignorar)
3. Timer peripheral básico (generar tick FreeRTOS periódicamente)
4. Una vez activo FreeRTOS: sketches Arduino normales deberían funcionar

### Otras limitaciones

| Limitación | Detalle |
|------------|---------|
| Sin WiFi | El ESP32-C3 tiene radio BLE/WiFi; no emulada |
| Sin ADC | GPIO 0-5 como ADC no implementado |
| Sin SPI/I2C hardware | Los periféricos hardware SPI/I2C retornan 0 |
| Sin interrupciones | `attachInterrupt()` no funciona |
| Sin RTC | `esp_sleep_*`, `rtc_*` no implementados |
| Sin NVS/Flash writes | `Preferences`, `SPIFFS` no implementados |

---

## 11. Tests

Los tests de la emulación RISC-V están en `frontend/src/__tests__/`:

```bash
cd frontend
npm test -- esp32c3
```

### `esp32c3-simulation.test.ts` — 30 tests (ISA unit tests)

Verifica directamente el decodificador de instrucciones de `RiscVCore`:

| Grupo | Tests | Qué verifica |
|-------|-------|--------------|
| RV32M | 8 | MUL, MULH, MULHSU, MULHU, DIV, DIVU, REM, REMU |
| RV32C | 7 | C.ADDI, C.LI, C.LWSP, C.SWSP, C.MV, C.ADD, C.J, C.BEQZ |
| UART | 3 | Escritura a FIFO → onSerialData, lectura de RX, múltiples bytes |
| GPIO | 8 | W1TS set bit, W1TC clear bit, toggle, timestamp, múltiples pines |
| Lifecycle | 4 | reset(), start/stop, loadHex básico |

### `esp32c3-blink.test.ts` — 8 tests (integración end-to-end)

Compila `blink.c` con `riscv32-esp-elf-gcc` (el toolchain de arduino-cli) y verifica la ejecución en el simulador:

| Test | Qué verifica |
|------|-------------|
| `build.sh produces blink.bin` | El toolchain compila correctamente |
| `binary starts with valid RV32 instruction` | El entry point es código RISC-V válido |
| `loadBin() resets PC to 0x42000000` | Carga correcta en flash |
| `GPIO 8 goes HIGH after first SW` | Primer toggle correcto |
| `GPIO 8 toggles ON and OFF` | 7 toggles en 2000 pasos (4 ON, 3 OFF) |
| `PinManager.setPinState called` | Integración con el sistema de componentes |
| `timestamps increase monotonically` | El tiempo simulado es consistente |
| `reset() clears GPIO state` | Reset funcional |

**Resultado esperado:**
```
✓ esp32c3-simulation.test.ts  (30 tests)  ~500ms
✓ esp32c3-blink.test.ts        (8 tests)  ~300ms
```

### Binario de prueba bare-metal

```
frontend/src/__tests__/fixtures/esp32c3-blink/
├── blink.c       ← código fuente bare-metal
├── link.ld       ← linker script (IROM @ 0x42000000, DRAM @ 0x3FC80000)
├── build.sh      ← script de compilación (usa toolchain de arduino-cli)
├── blink.elf     ← (generado) ELF con debug info
├── blink.bin     ← (generado) binario raw de 58 bytes
└── blink.dis     ← (generado) desensamblado para inspección
```

---

## 12. Diferencias vs emulación Xtensa (ESP32 / ESP32-S3)

| Aspecto | ESP32-C3 (RISC-V) | ESP32 / ESP32-S3 (Xtensa) |
|---------|-------------------|--------------------------|
| Motor | `Esp32C3Simulator` (TypeScript, navegador) | `Esp32Bridge` + backend QEMU |
| Dependencia backend | **No** — 100% en el navegador | Sí — WebSocket a proceso QEMU |
| Arranque | Instantáneo | ~1-2 segundos |
| GPIO | Via MMIO W1TS/W1TC | Via QEMU callbacks → WebSocket |
| WiFi | No emulada | Emulada (SSIDs hardcoded) |
| I2C/SPI hardware | No emulado | Emulado (callbacks síncronos) |
| LEDC/PWM | No emulado | Emulado (poll periódico) |
| NeoPixel/RMT | No emulado | Emulado (decodificador RMT) |
| Arduino framework | Parcial (FreeRTOS no activo) | Completo |
| Tests CI | Sí (Vitest) | No (requiere lib nativa) |

---

## 13. Archivos clave

| Archivo | Descripción |
|---------|-------------|
| `frontend/src/simulation/RiscVCore.ts` | Núcleo del emulador RV32IMC (I + M + C extensions) |
| `frontend/src/simulation/Esp32C3Simulator.ts` | Mapa de memoria ESP32-C3, GPIO, UART0, ciclo RAF |
| `frontend/src/utils/esp32ImageParser.ts` | Parser del formato imagen ESP32 (merged flash → segmentos) |
| `frontend/src/store/useSimulatorStore.ts` | `ESP32_RISCV_KINDS`, `createSimulator()`, `compileBoardProgram()` |
| `frontend/src/__tests__/esp32c3-simulation.test.ts` | Unit tests ISA (30 tests) |
| `frontend/src/__tests__/esp32c3-blink.test.ts` | Integration test end-to-end (8 tests) |
| `frontend/src/__tests__/fixtures/esp32c3-blink/` | Firmware bare-metal de prueba + toolchain script |
