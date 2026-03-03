# Project Architecture - Arduino Emulator

## Overview

This project is a fully local Arduino emulator using official Wokwi repositories for maximum compatibility.

```
┌─────────────────────────────────────────────────────────────┐
│                    USER (Browser)                           │
│                   http://localhost:5173                      │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  FRONTEND (React + Vite)                     │
│                                                              │
│  ┌────────────────┐  ┌──────────────────┐  ┌─────────────┐ │
│  │ Monaco Editor  │  │  Zustand Store   │  │  Simulator  │ │
│  │  (Code Edit)   │  │  (State Mgmt)    │  │   Canvas    │ │
│  └────────────────┘  └──────────────────┘  └─────────────┘ │
│           │                   │                      │       │
│           └───────────────────┴──────────────────────┘       │
│                              │                               │
│                              ▼                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Wokwi Components Integration                 │   │
│  │  (wokwi-elements + avr8js from local repos)         │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP (axios)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              BACKEND (FastAPI + Python)                      │
│                http://localhost:8000                         │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  POST /api/compile                                   │    │
│  │  - Receives Arduino code (.ino)                      │    │
│  │  - Compiles with arduino-cli                         │    │
│  │  - Returns .hex file                                 │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │         Arduino CLI Service                          │    │
│  │  (Invokes arduino-cli as subprocess)                 │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
                ┌──────────────────────┐
                │    arduino-cli       │
                │   (Local system)     │
                └──────────────────────┘
```

## Data Flow: Compilation and Simulation

### 1. Code Editing
```
User writes code
    ↓
Monaco Editor
    ↓
Zustand (useEditorStore)
    ↓
State: code
```

### 2. Compilation
```
Click "Compile"
    ↓
EditorToolbar.tsx → compileCode()
    ↓
Axios POST → http://localhost:8000/api/compile
    ↓
Backend: ArduinoCLIService.compile()
    ↓
arduino-cli compile --fqbn arduino:avr:uno
    ↓
Generates .hex file in temp directory
    ↓
Backend reads .hex and returns content
    ↓
Frontend: useSimulatorStore.setCompiledHex()
```

### 3. Simulation (Currently simplified)
```
Click "Run"
    ↓
useSimulatorStore.setRunning(true)
    ↓
SimulatorCanvas: useEffect detects running=true
    ↓
setInterval every 1000ms
    ↓
updateComponentState('led-builtin', !state)
    ↓
wokwi-led component updates visually
```

### 4. Real Simulation (Coming with avr8js)
```
Compiled .hex file
    ↓
AVRSimulator.loadHex(hex)
    ↓
hexParser → Uint16Array (program memory)
    ↓
CPU = new CPU(program)
    ↓
Click "Run" → AVRSimulator.start()
    ↓
requestAnimationFrame loop
    ↓
CPU.tick() × 267,000 cycles/frame
    ↓
Writes to PORTB/PORTC/PORTD
    ↓
Write hooks → PinManager.updatePort()
    ↓
PinManager notifies callbacks
    ↓
Components update visual state
```

## Key Components

### Frontend

#### 1. Stores (Zustand)
- **[useEditorStore.ts](frontend/src/store/useEditorStore.ts)**
  - `code`: Current source code
  - `theme`: Editor theme (dark/light)
  - `setCode()`: Update code

- **[useSimulatorStore.ts](frontend/src/store/useSimulatorStore.ts)**
  - `running`: Simulation state
  - `compiledHex`: Compiled hex file
  - `components`: List of electronic components
  - `setCompiledHex()`: Save hex
  - `updateComponentState()`: Update LED/component

#### 2. UI Components
- **[CodeEditor.tsx](frontend/src/components/editor/CodeEditor.tsx)**
  - Monaco Editor wrapper
  - C++ syntax highlighting
  - Auto-completion

- **[EditorToolbar.tsx](frontend/src/components/editor/EditorToolbar.tsx)**
  - Buttons: Compile, Run, Stop
  - Compilation state handling
  - Error/success messages

- **[SimulatorCanvas.tsx](frontend/src/components/simulator/SimulatorCanvas.tsx)**
  - Renders Arduino Uno
  - Renders components (LEDs)
  - Simulation loop

#### 3. Wokwi Component Wrappers
- **[LED.tsx](frontend/src/components/components-wokwi/LED.tsx)**
  - React wrapper for `<wokwi-led>`
  - Props: color, value, x, y

- **[ArduinoUno.tsx](frontend/src/components/components-wokwi/ArduinoUno.tsx)**
  - React wrapper for `<wokwi-arduino-uno>`
  - Internal LED control (pin 13)

- **[Resistor.tsx](frontend/src/components/components-wokwi/Resistor.tsx)**
  - React wrapper for `<wokwi-resistor>`
  - Props: value (ohms)

- **[Pushbutton.tsx](frontend/src/components/components-wokwi/Pushbutton.tsx)**
  - React wrapper for `<wokwi-pushbutton>`
  - Events: onPress, onRelease

### Backend

#### 1. API Routes
- **[compile.py](backend/app/api/routes/compile.py)**
  - `POST /api/compile`: Compile code
  - `GET /api/compile/boards`: List boards

#### 2. Services
- **[arduino_cli.py](backend/app/services/arduino_cli.py)**
  - `compile()`: Compile sketch with arduino-cli
  - `list_boards()`: Get available boards
  - Temporary directory management

### Wokwi Libraries (Cloned Locally)

#### 1. wokwi-elements
- **Location**: `wokwi-libs/wokwi-elements/`
- **Build**: `dist/esm/` and `dist/cjs/`
- **Components**: 50+ electronic elements
- **Technology**: Lit (Web Components)

#### 2. avr8js
- **Location**: `wokwi-libs/avr8js/`
- **Build**: `dist/esm/` and `dist/cjs/`
- **Functionality**: Complete ATmega328p emulator
- **Supports**: CPU, Timers, USART, GPIO, ADC, etc.

#### 3. rp2040js
- **Location**: `wokwi-libs/rp2040js/`
- **Future use**: Raspberry Pi Pico support

## Vite Integration

### Alias Configuration
```typescript
// vite.config.ts
resolve: {
  alias: {
    'avr8js': path.resolve(__dirname, '../wokwi-libs/avr8js/dist/esm'),
    '@wokwi/elements': path.resolve(__dirname, '../wokwi-libs/wokwi-elements/dist/esm'),
  },
}
```

This allows:
- Use local repos instead of npm
- Easy updates with `git pull`
- Modify source code if needed

## Technology Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|-----------|
| React | 19.2 | UI framework |
| Vite | 7.3 | Build tool & dev server |
| TypeScript | 5.9 | Static typing |
| Monaco Editor | 4.7 | Code editor (VSCode) |
| Zustand | 5.0 | State management |
| Axios | 1.13 | HTTP client |
| wokwi-elements | 1.9.2 | Electronic components |
| avr8js | 0.21.0 | AVR8 emulator |

### Backend
| Technology | Version | Purpose |
|------------|---------|-----------|
| Python | 3.12+ | Runtime |
| FastAPI | 0.115 | Web framework |
| Uvicorn | 0.32 | ASGI server |
| SQLAlchemy | 2.0 | ORM (future) |
| aiosqlite | 0.20 | Async DB (future) |

### External Tools
| Tool | Purpose |
|------|---------|
| arduino-cli | Arduino compiler |
| Git | Version control for Wokwi libs |

## Architecture Advantages

### ✅ Separation of Concerns
- **Frontend**: UI, UX, visualization
- **Backend**: Compilation, business logic
- **Wokwi Libs**: Emulation and components (maintained by Wokwi)

### ✅ Wokwi Compatibility
- Official repositories = same functionality
- Automatic updates with `git pull`
- New components available immediately

### ✅ Scalability
- Frontend can easily add more components
- Backend can add more endpoints (projects, sensors)
- Wokwi libs update independently

### ✅ Local Development
- No internet required to work
- Local compilation with arduino-cli
- Local database (SQLite)

## Upcoming Improvements

### Phase 2: Real Emulation (avr8js)
```
[ ] Implement AVRSimulator.ts
[ ] Intel HEX file parser
[ ] PinManager with write hooks
[ ] Integrate CPU execution loop
[ ] Map Arduino pins to components
```

### Phase 3: More Components
```
[ ] Integrate more wokwi-elements
[ ] Buttons, potentiometers
[ ] Sensors (DHT22, HC-SR04)
[ ] Displays (LCD, 7-segment)
```

### Phase 4: Persistence
```
[ ] SQLite database
[ ] SQLAlchemy models
[ ] Project CRUD
[ ] Save circuits as JSON
```

### Phase 5: Advanced Features
```
[ ] Serial Monitor
[ ] Visual wiring (drag & drop)
[ ] Multiple boards (Mega, Nano, ESP32)
[ ] Export to Wokwi.com
```

## References

- [Wokwi Elements Repo](https://github.com/wokwi/wokwi-elements)
- [AVR8js Repo](https://github.com/wokwi/avr8js)
- [Wokwi Simulator](https://wokwi.com)
- [Arduino CLI](https://arduino.github.io/arduino-cli/)
- [FastAPI Docs](https://fastapi.tiangolo.com/)
- [Vite Docs](https://vitejs.dev/)
