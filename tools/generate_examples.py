"""
generate_examples.py — Velxio example project generator helper
================================================================
This script catalogs board × sensor combinations and can generate
TypeScript example stubs for inserting into
  frontend/src/data/examples.ts

Usage:
  python tools/generate_examples.py            # print catalog summary
  python tools/generate_examples.py --generate # print TypeScript stubs
  python tools/generate_examples.py --shuffle  # random combinations

Pin-name reference
------------------
Board component IDs used in wire objects:
  arduino-uno     → component rendered by wokwi-arduino-uno
  nano-rp2040     → component rendered by wokwi-nano-rp2040-connect
  esp32           → component rendered by wokwi-esp32-devkit-v1
  esp32-c3        → custom ESP32-C3 DevKitM-1 canvas element

Board pin names for wires  (from wokwi-elements *.ts pinInfo arrays):
  Arduino Uno:
    digital     '2'…'13'
    analog      'A0'…'A5'   (A4=I2C-SDA, A5=I2C-SCL)
    power       '5V', 'GND', '3.3V'
    PWM capable  3, 5, 6, 9, 10, 11

  Raspberry Pi Pico (nano-rp2040-connect element, GP-style convention):
    digital     'GP0'…'GP22'
    ADC         'A0'(GP26), 'A1'(GP27), 'A2'(GP28)
    I2C default 'GP4'(SDA), 'GP5'(SCL)
    power       '3.3V', 'GND.1'
    PWM capable  any GP pin

  ESP32 DevKit-V1:
    digital     'D2','D4','D5','D12'…'D27','D32','D33'
    analog-only 'D34','D35','VP','VN'
    I2C         'D21'(SDA), 'D22'(SCL)
    power       '3V3', 'VIN'(5V), 'GND.1'
    PWM capable  most D pins except 34, 35

  ESP32-C3 DevKitM-1:
    digital     '0'…'21'
    I2C default '8'(SDA), '9'(SCL)
    power       '3V3', 'GND.9'
    PWM capable  most GPIO

Sensor pin names  (from wokwi-elements *.ts pinInfo arrays):
  wokwi-dht22                 VCC, SDA, NC, GND
  wokwi-hc-sr04               VCC, TRIG, ECHO, GND
  wokwi-pir-motion-sensor     VCC, OUT, GND
  wokwi-servo                 GND, V+, PWM
  wokwi-photoresistor-sensor  VCC, GND, DO, AO
  wokwi-ntc-temperature-sensor GND, VCC, OUT
  wokwi-buzzer                1, 2
  wokwi-analog-joystick       VCC, VERT, HORZ, SEL, GND
  wokwi-mpu6050               INT, AD0, XCL, XDA, SDA, SCL, GND, VCC
  wokwi-potentiometer         VCC, SIG, GND
"""

import json
import random
import sys
import textwrap
from typing import NamedTuple


# ── Board definitions ─────────────────────────────────────────────────────────

class Board(NamedTuple):
    id: str                   # component-id in wires
    board_type: str           # boardType/boardFilter value
    board_type_key: str       # boardType key in TS
    vcc_pin: str              # 3.3 V or 5 V power pin
    gnd_pin: str              # ground pin
    analog_pin: str           # first ADC pin
    pwm_pin: str              # a PWM-capable digital pin
    i2c_sda: str
    i2c_scl: str
    serial_baud: int


BOARDS = [
    Board(
        id='arduino-uno', board_type='arduino-uno', board_type_key="'arduino-uno'",
        vcc_pin='5V', gnd_pin='GND', analog_pin='A0', pwm_pin='9',
        i2c_sda='A4', i2c_scl='A5', serial_baud=9600,
    ),
    Board(
        id='nano-rp2040', board_type='raspberry-pi-pico', board_type_key="'raspberry-pi-pico'",
        vcc_pin='3.3V', gnd_pin='GND.1', analog_pin='A0', pwm_pin='GP15',
        i2c_sda='GP4', i2c_scl='GP5', serial_baud=115200,
    ),
    Board(
        id='esp32', board_type='esp32', board_type_key="'esp32'",
        vcc_pin='3V3', gnd_pin='GND.1', analog_pin='D34', pwm_pin='D18',
        i2c_sda='D21', i2c_scl='D22', serial_baud=115200,
    ),
    Board(
        id='esp32-c3', board_type='esp32-c3', board_type_key="'esp32-c3'",
        vcc_pin='3V3', gnd_pin='GND.9', analog_pin='',  # no ADC in simple examples
        pwm_pin='8', i2c_sda='8', i2c_scl='9', serial_baud=115200,
    ),
]


# ── Sensor definitions ────────────────────────────────────────────────────────

class Sensor(NamedTuple):
    id: str          # e.g. 'dht22'
    wokwi_type: str  # e.g. 'wokwi-dht22'
    name: str        # human-readable
    category: str    # 'sensors' | 'robotics' | etc.
    pins: dict       # pin-role → pin-name on sensor element


SENSORS = [
    Sensor(
        id='dht22', wokwi_type='wokwi-dht22',
        name='DHT22 Temperature & Humidity',
        category='sensors',
        pins={'vcc': 'VCC', 'gnd': 'GND', 'data': 'SDA'},
    ),
    Sensor(
        id='hc-sr04', wokwi_type='wokwi-hc-sr04',
        name='HC-SR04 Ultrasonic Distance',
        category='sensors',
        pins={'vcc': 'VCC', 'gnd': 'GND', 'trig': 'TRIG', 'echo': 'ECHO'},
    ),
    Sensor(
        id='pir', wokwi_type='wokwi-pir-motion-sensor',
        name='PIR Motion Sensor',
        category='sensors',
        pins={'vcc': 'VCC', 'gnd': 'GND', 'out': 'OUT'},
    ),
    Sensor(
        id='servo', wokwi_type='wokwi-servo',
        name='Servo Motor',
        category='robotics',
        pins={'vcc': 'V+', 'gnd': 'GND', 'pwm': 'PWM'},
    ),
    Sensor(
        id='photoresistor', wokwi_type='wokwi-photoresistor-sensor',
        name='Photoresistor Light Sensor',
        category='sensors',
        pins={'vcc': 'VCC', 'gnd': 'GND', 'do': 'DO', 'ao': 'AO'},
    ),
    Sensor(
        id='ntc', wokwi_type='wokwi-ntc-temperature-sensor',
        name='NTC Thermistor Temperature',
        category='sensors',
        pins={'vcc': 'VCC', 'gnd': 'GND', 'out': 'OUT'},
    ),
    Sensor(
        id='mpu6050', wokwi_type='wokwi-mpu6050',
        name='MPU-6050 Accelerometer/Gyroscope',
        category='sensors',
        pins={'vcc': 'VCC', 'gnd': 'GND', 'sda': 'SDA', 'scl': 'SCL'},
    ),
    Sensor(
        id='joystick', wokwi_type='wokwi-analog-joystick',
        name='Analog Joystick',
        category='sensors',
        pins={'vcc': 'VCC', 'gnd': 'GND', 'vert': 'VERT', 'horz': 'HORZ', 'sel': 'SEL'},
    ),
    Sensor(
        id='buzzer', wokwi_type='wokwi-buzzer',
        name='Piezo Buzzer',
        category='basics',
        pins={'p1': '1', 'p2': '2'},
    ),
    Sensor(
        id='potentiometer', wokwi_type='wokwi-potentiometer',
        name='Potentiometer',
        category='sensors',
        pins={'vcc': 'VCC', 'gnd': 'GND', 'sig': 'SIG'},
    ),
]

SENSOR_BY_ID = {s.id: s for s in SENSORS}
BOARD_BY_ID  = {b.id: b for b in BOARDS}


# ── Catalogue: which sensor works on which board ──────────────────────────────
# Format: { board_id: [ (sensor_id, digital_pin_for_data, extra_pins), ... ] }
# extra_pins are additional wires needed beyond VCC/GND

CATALOGUE: dict[str, list[tuple]] = {
    'arduino-uno': [
        ('dht22',         {'data': '7'}),
        ('hc-sr04',       {'trig': '9', 'echo': '10'}),
        ('pir',           {'out': '4'}),
        ('servo',         {'pwm': '9'}),
        ('photoresistor', {'ao': 'A0', 'do': '8'}),
        ('ntc',           {'out': 'A1'}),
    ],
    'nano-rp2040': [
        ('dht22',         {'data': 'GP7'}),
        ('hc-sr04',       {'trig': 'GP9', 'echo': 'GP10'}),
        ('pir',           {'out': 'GP14'}),
        ('servo',         {'pwm': 'GP15'}),
        ('ntc',           {'out': 'A0'}),
        ('joystick',      {'vert': 'A0', 'horz': 'A1', 'sel': 'GP14'}),
    ],
    'esp32': [
        ('dht22',         {'data': 'D4'}),
        ('hc-sr04',       {'trig': 'D18', 'echo': 'D19'}),
        ('pir',           {'out': 'D5'}),
        ('servo',         {'pwm': 'D13'}),
        ('mpu6050',       {'sda': 'D21', 'scl': 'D22'}),
        ('joystick',      {'vert': 'D34', 'horz': 'D35', 'sel': 'D15'}),
    ],
    'esp32-c3': [
        ('dht22',         {'data': '3'}),
        ('hc-sr04',       {'trig': '5', 'echo': '6'}),
        ('pir',           {'out': '7'}),
        ('servo',         {'pwm': '10'}),
    ],
}


# ── Simple catalog printout ───────────────────────────────────────────────────

def print_catalog():
    print("=" * 60)
    print("Velxio Example Catalog")
    print("=" * 60)
    total = 0
    for board_id, combos in CATALOGUE.items():
        board = BOARD_BY_ID[board_id]
        print(f"\n{board.board_type} ({board_id})")
        print("-" * 40)
        for sensor_id, pins in combos:
            sensor = SENSOR_BY_ID[sensor_id]
            pin_str = ', '.join(f'{k}={v}' for k, v in pins.items())
            print(f"  [{sensor.category:10s}] {sensor.name:35s} pins: {pin_str}")
            total += 1
    print(f"\nTotal combinations: {total}")


# ── Random shuffle helper ─────────────────────────────────────────────────────

def shuffle_combos(seed: int = 42, count: int = 10):
    """Return `count` random (board, sensor) pairs."""
    random.seed(seed)
    all_combos = []
    for board_id, combos in CATALOGUE.items():
        for sensor_id, pins in combos:
            all_combos.append((board_id, sensor_id, pins))
    random.shuffle(all_combos)
    return all_combos[:count]


# ── TypeScript stub generator ─────────────────────────────────────────────────

def _ts_id(board_id: str, sensor_id: str) -> str:
    short = board_id.replace('arduino-', '').replace('nano-rp2040', 'pico') \
                    .replace('esp32-c3', 'c3').replace('esp32', 'esp32')
    return f"{short}-{sensor_id.replace('-', '')}"


def generate_stub(board_id: str, sensor_id: str, pins: dict) -> str:
    board  = BOARD_BY_ID[board_id]
    sensor = SENSOR_BY_ID[sensor_id]
    ts_id  = _ts_id(board_id, sensor_id)

    # Wires
    wire_lines = []
    wire_idx = 0
    # VCC wire
    wire_lines.append(
        f"      {{ id: '{ts_id}-vcc',  start: {{ componentId: '{board.id}', pinName: '{board.vcc_pin}' }}, "
        f"end: {{ componentId: '{ts_id}-s', pinName: '{sensor.pins.get('vcc', 'VCC')}' }}, color: '#ff0000' }},"
    )
    wire_idx += 1
    # GND wire
    wire_lines.append(
        f"      {{ id: '{ts_id}-gnd',  start: {{ componentId: '{board.id}', pinName: '{board.gnd_pin}' }}, "
        f"end: {{ componentId: '{ts_id}-s', pinName: '{sensor.pins.get('gnd', 'GND')}' }}, color: '#000000' }},"
    )
    # Data wires
    for role, sensor_pin in sensor.pins.items():
        if role in ('vcc', 'gnd'):
            continue
        board_pin = pins.get(role, '?')
        wire_lines.append(
            f"      {{ id: '{ts_id}-{role}', start: {{ componentId: '{board.id}', pinName: '{board_pin}' }}, "
            f"end: {{ componentId: '{ts_id}-s', pinName: '{sensor_pin}' }}, color: '#22aaff' }},"
        )

    wires_block = '\n'.join(wire_lines)

    stub = f"""  {{
    id: '{ts_id}',
    title: '{board.board_type.title()}: {sensor.name}',
    description: '// TODO: add description',
    category: '{sensor.category}',
    difficulty: 'beginner',
    boardType: {board.board_type_key},
    boardFilter: {board.board_type_key},
    code: `// {board.board_type} — {sensor.name}
// TODO: add Arduino code`,
    components: [
      {{ type: '{sensor.wokwi_type}', id: '{ts_id}-s', x: 430, y: 150, properties: {{}} }},
    ],
    wires: [
{wires_block}
    ],
  }},"""
    return stub


def generate_all_stubs():
    print("// === AUTO-GENERATED STUBS from tools/generate_examples.py ===\n")
    print("// Paste into exampleProjects[] in frontend/src/data/examples.ts\n")
    for board_id, combos in CATALOGUE.items():
        print(f"\n  // ─── {BOARD_BY_ID[board_id].board_type} ───\n")
        for sensor_id, pins in combos:
            print(generate_stub(board_id, sensor_id, pins))
            print()


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == '__main__':
    args = sys.argv[1:]
    if '--generate' in args or '--stubs' in args:
        generate_all_stubs()
    elif '--shuffle' in args:
        seed = int(args[args.index('--shuffle') + 1]) if '--shuffle' in args and len(args) > args.index('--shuffle') + 1 else 42
        combos = shuffle_combos(seed=seed, count=12)
        print(f"\nShuffled combinations (seed={seed}):\n")
        for board_id, sensor_id, pins in combos:
            b = BOARD_BY_ID[board_id]
            s = SENSOR_BY_ID[sensor_id]
            print(f"  {b.board_type:25s} + {s.name}")
        print()
        print("Run with --generate to see TypeScript stubs.\n")
    else:
        print_catalog()
        print("""
Usage:
  python tools/generate_examples.py            # catalog summary
  python tools/generate_examples.py --generate # TypeScript stub output
  python tools/generate_examples.py --shuffle  # random combo list
""")
