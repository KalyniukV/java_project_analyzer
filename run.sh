#!/usr/bin/env bash
# ==============================================================================
#  JavaLens - 1-Click Desktop App Launcher (Linux / macOS / Bash)
# ==============================================================================
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

PROJECT_PATH="${1:-fixtures/sample-petclinic}"

BINARY="$ROOT_DIR/target/release/javalens"
FRONTEND_DIST="$ROOT_DIR/frontend/dist/index.html"

if [ ! -f "$BINARY" ] || [ ! -f "$FRONTEND_DIST" ]; then
    echo "⚠️ Application not built yet. Running build.sh first..."
    chmod +x "$ROOT_DIR/build.sh"
    "$ROOT_DIR/build.sh"
fi

echo "========================================================"
echo "         🚀 Launching JavaLens Desktop App              "
echo "========================================================"
echo "Target Project : $PROJECT_PATH"
echo "Framework      : Tauri 2.0 Native Desktop Window"
echo ""

"$BINARY" "$PROJECT_PATH"
