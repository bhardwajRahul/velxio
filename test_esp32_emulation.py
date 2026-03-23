#!/usr/bin/env python3
"""
ESP32 Emulation Integration Test
=================================
Tests the full pipeline:
  1. Compile ESP32 Blink sketch via HTTP POST /api/compile
  2. Connect WebSocket to /api/simulation/ws/test-esp32
  3. Send start_esp32 with the compiled 4MB firmware
  4. Wait for system events (booting, booted) and gpio_change events
  5. Report success/failure

Usage:
    python test_esp32_emulation.py
    python test_esp32_emulation.py --base http://localhost:8001
"""
import argparse
import asyncio
import io
import json
import sys
import time

# Force UTF-8 on Windows so checkmarks/symbols don't crash
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
import httpx
import websockets

BLINK_SKETCH = """\
// ESP32 Blink LED - Test Sketch
// Blinks GPIO4 at 500ms intervals, outputs status on Serial
#define LED_PIN 4

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  Serial.println("ESP32 Blink ready!");
}

void loop() {
  digitalWrite(LED_PIN, HIGH);
  Serial.println("LED ON");
  delay(500);
  digitalWrite(LED_PIN, LOW);
  Serial.println("LED OFF");
  delay(500);
}
"""


def print_section(title: str):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")


async def run_test(base_url: str):
    ws_url = base_url.replace("http://", "ws://").replace("https://", "wss://")

    # ── Step 1: Compile ───────────────────────────────────────────────────────
    print_section("Step 1: Compile ESP32 Blink sketch")

    async with httpx.AsyncClient(base_url=base_url, timeout=120.0) as client:
        payload = {
            "files": [{"name": "sketch.ino", "content": BLINK_SKETCH}],
            "board_fqbn": "esp32:esp32:esp32",
        }
        print(f"  POST {base_url}/api/compile/")
        t0 = time.time()
        resp = await client.post("/api/compile/", json=payload)
        elapsed = time.time() - t0

    print(f"  Status: {resp.status_code}  ({elapsed:.1f}s)")
    if resp.status_code != 200:
        print(f"  FAIL: {resp.text}")
        return False

    data = resp.json()
    if not data.get("success"):
        print(f"  FAIL: compilation failed")
        print(f"  stderr: {data.get('stderr', '')[:500]}")
        return False

    firmware_b64: str = data.get("binary_content", "")
    fw_bytes = len(firmware_b64) * 3 // 4
    print(f"  OK — firmware {fw_bytes // 1024} KB base64-encoded")

    if fw_bytes < 1024 * 1024:
        print(f"  WARN: firmware < 1 MB ({fw_bytes} bytes). "
              f"QEMU needs a 4MB merged image. Expected ~4194304 bytes.")
        print(f"  This suggests the esptool merge step did not run.")
    else:
        print(f"  OK — firmware size looks like a full flash image ✓")

    # ── Step 2: WebSocket Simulation ─────────────────────────────────────────
    print_section("Step 2: Connect WebSocket and start ESP32 emulation")

    ws_endpoint = f"{ws_url}/api/simulation/ws/test-esp32"
    print(f"  Connecting to {ws_endpoint}")

    results = {
        "connected": False,
        "booting": False,
        "booted": False,
        "serial_lines": [],
        "gpio_changes": [],
        "errors": [],
    }

    try:
        async with websockets.connect(ws_endpoint, open_timeout=10) as ws:
            results["connected"] = True
            print("  WebSocket connected ✓")

            # Send start_esp32 with firmware
            msg = json.dumps({
                "type": "start_esp32",
                "data": {
                    "board": "esp32",
                    "firmware_b64": firmware_b64,
                },
            })
            await ws.send(msg)
            print("  Sent start_esp32 (firmware attached)")

            # Listen for events for up to 20 seconds
            deadline = time.time() + 20
            print("  Waiting for events (up to 20s)...")

            while time.time() < deadline:
                remaining = deadline - time.time()
                try:
                    raw = await asyncio.wait_for(ws.recv(), timeout=min(remaining, 2.0))
                    evt = json.loads(raw)
                    evt_type = evt.get("type", "")
                    evt_data = evt.get("data", {})

                    if evt_type == "system":
                        event_name = evt_data.get("event", "")
                        print(f"  [system] {event_name}")
                        if event_name == "booting":
                            results["booting"] = True
                        elif event_name == "booted":
                            results["booted"] = True
                        elif event_name == "crash":
                            print(f"  CRASH: {json.dumps(evt_data)}")
                            results["errors"].append(f"crash: {evt_data}")

                    elif evt_type == "serial_output":
                        text = evt_data.get("data", "")
                        sys.stdout.write(f"  [serial] {text}")
                        sys.stdout.flush()
                        results["serial_lines"].append(text)

                    elif evt_type == "gpio_change":
                        pin = evt_data.get("pin")
                        state = evt_data.get("state")
                        label = "HIGH" if state == 1 else "LOW"
                        print(f"  [gpio] pin={pin} → {label}")
                        results["gpio_changes"].append((pin, state))

                    elif evt_type == "gpio_dir":
                        pin = evt_data.get("pin")
                        direction = "OUTPUT" if evt_data.get("dir") == 1 else "INPUT"
                        print(f"  [gpio_dir] pin={pin} → {direction}")

                    elif evt_type == "error":
                        msg_text = evt_data.get("message", "")
                        print(f"  [error] {msg_text}")
                        results["errors"].append(msg_text)

                    # Stop early if we got at least 2 gpio toggles on pin 4
                    pin4_toggles = [(p, s) for p, s in results["gpio_changes"] if p == 4]
                    if len(pin4_toggles) >= 2:
                        print(f"\n  Got {len(pin4_toggles)} GPIO4 toggles — stopping early ✓")
                        break

                except asyncio.TimeoutError:
                    continue

    except Exception as e:
        print(f"  WebSocket error: {e}")
        results["errors"].append(str(e))

    # ── Step 3: Report ────────────────────────────────────────────────────────
    print_section("Test Results")

    ok = True

    checks = [
        ("WebSocket connected",       results["connected"]),
        ("QEMU booting event",        results["booting"]),
        ("QEMU booted event",         results["booted"]),
        ("Serial output received",    bool(results["serial_lines"])),
        ("GPIO4 toggled at least once", any(p == 4 for p, _ in results["gpio_changes"])),
        ("GPIO4 toggled HIGH+LOW",    (
            any(p == 4 and s == 1 for p, s in results["gpio_changes"]) and
            any(p == 4 and s == 0 for p, s in results["gpio_changes"])
        )),
    ]

    for label, passed in checks:
        icon = "✓" if passed else "✗"
        print(f"  {icon} {label}")
        if not passed:
            ok = False

    if results["errors"]:
        print(f"\n  Errors encountered:")
        for e in results["errors"]:
            print(f"    - {e}")

    if results["gpio_changes"]:
        print(f"\n  GPIO changes recorded: {results['gpio_changes'][:10]}")

    if results["serial_lines"]:
        joined = "".join(results["serial_lines"])
        print(f"\n  Serial output (first 300 chars):\n    {joined[:300]!r}")

    print()
    if ok:
        print("  ALL CHECKS PASSED ✓  — ESP32 emulation is working end-to-end")
    else:
        print("  SOME CHECKS FAILED ✗  — see above for details")
    print()

    return ok


def main():
    parser = argparse.ArgumentParser(description="ESP32 emulation integration test")
    parser.add_argument("--base", default="http://localhost:8001",
                        help="Backend base URL (default: http://localhost:8001)")
    args = parser.parse_args()

    ok = asyncio.run(run_test(args.base))
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
