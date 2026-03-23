# Velxio — Introduction

**Velxio** is a fully local, open-source Arduino emulator that runs entirely in your browser.

Write Arduino C++ code, compile it with a real `arduino-cli` backend, and simulate it using true AVR8 / RP2040 CPU emulation — with 48+ interactive electronic components, all without installing any software on your machine.

---

## Why Velxio?

- **No installation required** — everything runs in the browser.
- **Real emulation** — not a simplified model, but accurate AVR8 / RP2040 CPU emulation.
- **Interactive components** — LEDs, buttons, potentiometers, displays, sensors, and more.
- **Open-source** — inspect, modify, and self-host it yourself.

---

## Supported Boards

| Board | CPU | Emulator |
|-------|-----|----------|
| Arduino Uno | ATmega328p @ 16 MHz | avr8js |
| Arduino Nano | ATmega328p @ 16 MHz | avr8js |
| Arduino Mega | ATmega2560 @ 16 MHz | avr8js |
| Raspberry Pi Pico | RP2040 @ 133 MHz | rp2040js |

---

## Documentation

### Getting Started

- [Getting Started](./getting-started.md) — Quick setup guide (hosted, Docker, manual)
- [Introduction](./intro.md) — Overview, supported boards, quick links

### Architecture & Internals

- [Architecture](./ARCHITECTURE.md) — High-level project architecture
- [Emulator Architecture](./emulator.md) — How CPU emulation works layer by layer
- [Wokwi Libraries Integration](./WOKWI_LIBS.md) — Local wokwi-elements, avr8js, rp2040js setup

### Boards & Emulation

- [RP2040 Emulation](./RP2040_EMULATION.md) — Raspberry Pi Pico / Pico W in-browser emulator (ARM Cortex-M0+)
- [Raspberry Pi 3 Emulation](./RASPBERRYPI3_EMULATION.md) — BCM2837 / QEMU raspi3b, Python + GPIO shim
- [ESP32 Emulation](./ESP32_EMULATION.md) — Full Xtensa QEMU emulation (GPIO, ADC, PWM, WiFi, I2C, SPI, RMT)
- [RISC-V Emulation](./RISCV_EMULATION.md) — ESP32-C3 / XIAO-C3 in-browser emulator

### Components & Examples

- [Components Reference](./components.md) — All 48+ supported electronic components
- [Example Projects](./examples/README.md) — Built-in example gallery

### API & Integrations

- [MCP Server](./MCP.md) — Model Context Protocol server for AI agent integration

### Project Status

- [Roadmap](./roadmap.md) — Implemented, in-progress, and planned features
- [Setup Complete](./SETUP_COMPLETE.md) — Feature implementation status log

---

## Community & Links

- [Live Demo](https://velxio.dev)
- [GitHub Repository](https://github.com/davidmonterocrespo24/velxio)
- [Discord](YOUR_DISCORD_INVITE_URL) — Ask questions, share projects, report issues
