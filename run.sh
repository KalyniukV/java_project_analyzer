#!/usr/bin/env bash
# ==============================================================================
#  JavaLens - 1-Click Desktop App Launcher (Linux / macOS / Bash)
# ==============================================================================
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

FORCE_BUILD=false
if [ "$1" == "--build" ] || [ "$1" == "-b" ] || [ "$2" == "--build" ] || [ "$2" == "-b" ]; then
    FORCE_BUILD=true
fi

if [ "$1" == "--build" ] || [ "$1" == "-b" ]; then
    PROJECT_PATH="${2:-fixtures/sample-petclinic}"
else
    PROJECT_PATH="${1:-fixtures/sample-petclinic}"
fi

BINARY="$ROOT_DIR/target/release/javalens"
FRONTEND_DIST="$ROOT_DIR/frontend/dist/index.html"

if [ ! -f "$BINARY" ] || [ ! -f "$FRONTEND_DIST" ] || [ "$FORCE_BUILD" = true ]; then
    echo "⚙️ Building JavaLens Desktop Application (Tauri)..."
    chmod +x "$ROOT_DIR/build.sh"
    "$ROOT_DIR/build.sh"
fi

echo "========================================================"
echo "         🚀 Launching JavaLens Desktop App (Tauri)      "
echo "========================================================"
echo "Target Project : $PROJECT_PATH"
echo "Binary         : $BINARY"
echo "Framework      : Tauri 2.0 Native Desktop Window"
echo ""

"$BINARY" "$PROJECT_PATH"
