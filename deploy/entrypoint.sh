#!/bin/bash
set -e

# If the arduino-cli volume is empty (first deploy or after prune),
# re-install the base cores. This is fast (~30s) since package index is cached.
if [ ! -f /root/.arduino15/arduino-cli.yaml ]; then
    echo "📦 Installing arduino-cli base cores into volume..."
    arduino-cli config init 2>/dev/null || true
    arduino-cli config add board_manager.additional_urls \
        https://github.com/earlephilhower/arduino-pico/releases/download/global/package_rp2040_index.json 2>/dev/null || true
    arduino-cli config add board_manager.additional_urls \
        https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json 2>/dev/null || true
    arduino-cli core update-index
    arduino-cli core install arduino:avr
    arduino-cli core install rp2040:rp2040
    arduino-cli core install esp32:esp32
    echo "✅ Base cores installed"
fi

# Start FastAPI backend in the background on port 8001
echo "🚀 Starting Velxio Backend..."
uvicorn app.main:app --host 127.0.0.1 --port 8001 &

# Wait for backend to be healthy (optional but good practice)
sleep 2

# Start Nginx in the foreground to keep the container running
echo "🌐 Starting Nginx Web Server on port 80..."
exec nginx -g "daemon off;"
