#!/usr/bin/env bash
# ==============================================================================
#  JavaLens - 1-Click Launch Script (Linux / macOS / Bash)
# ==============================================================================
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

PROJECT_PATH="${1:-fixtures/sample-petclinic}"
PORT="${PORT:-3030}"

BINARY="$ROOT_DIR/target/release/javalens"
FRONTEND_DIST="$ROOT_DIR/frontend/dist/index.html"

if [ ! -f "$BINARY" ] || [ ! -f "$FRONTEND_DIST" ]; then
    echo "⚠️ Application not built yet. Running build.sh first..."
    chmod +x "$ROOT_DIR/build.sh"
    "$ROOT_DIR/build.sh"
fi

echo "========================================================"
echo "              🚀 Launching JavaLens Server              "
echo "========================================================"
echo "Target Project : $PROJECT_PATH"
echo "Web Interface  : http://localhost:$PORT"
echo "Press Ctrl+C to stop the server."
echo ""

# Try opening browser if command exists
if command -v xdg-open &> /dev/null; then
    (sleep 2 && xdg-open "http://localhost:$PORT") &
elif command -v open &> /dev/null; then
    (sleep 2 && open "http://localhost:$PORT") &
fi

PORT="$PORT" "$BINARY" "$PROJECT_PATH"
