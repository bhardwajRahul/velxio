#!/bin/bash
set -e

# Seed arduino-cli data into the mounted volume if it's empty
# (first deploy or after volume prune). The base cores (avr, rp2040, esp32)
# were installed at build time and saved to /root/.arduino15-base.
if [ ! -f /root/.arduino15/arduino-cli.yaml ]; then
    echo "📦 Seeding arduino-cli cores into volume..."
    cp -a /root/.arduino15-base/* /root/.arduino15/ 2>/dev/null || \
    cp -a /root/.arduino15-base/. /root/.arduino15/
fi

# Start FastAPI backend in the background on port 8001
echo "🚀 Starting Velxio Backend..."
uvicorn app.main:app --host 127.0.0.1 --port 8001 &

# Wait for backend to be healthy (optional but good practice)
sleep 2

# Start Nginx in the foreground to keep the container running
echo "🌐 Starting Nginx Web Server on port 80..."
exec nginx -g "daemon off;"
