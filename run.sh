#!/usr/bin/env bash
# ==============================================================================
#  JavaLens - 1-Click Desktop App Launcher (Linux / macOS / Bash)
#  Launches the Tauri 2.0 native desktop window (NO browser)
# ==============================================================================
set -e

# Fix WebKitGTK black screen issue on Linux during high CPU loads
export WEBKIT_DISABLE_COMPOSITING_MODE=1
export WEBKIT_DISABLE_DMABUF_RENDERER=1

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

# Detect binary (Windows .exe vs Linux/macOS)
if [ -f "$ROOT_DIR/target/release/javalens.exe" ]; then
    BINARY="$ROOT_DIR/target/release/javalens.exe"
elif [ -f "$ROOT_DIR/target/release/javalens" ]; then
    BINARY="$ROOT_DIR/target/release/javalens"
else
    BINARY=""
fi

FRONTEND_DIST="$ROOT_DIR/frontend/dist/index.html"

# Auto-build if binary missing, frontend missing, or --build flag
if [ -z "$BINARY" ] || [ ! -f "$FRONTEND_DIST" ] || [ "$FORCE_BUILD" = true ]; then
    echo "⚙️ Building JavaLens Desktop Application (Tauri 2.0)..."
    chmod +x "$ROOT_DIR/build.sh"
    "$ROOT_DIR/build.sh"

    # Re-detect binary after build
    if [ -f "$ROOT_DIR/target/release/javalens.exe" ]; then
        BINARY="$ROOT_DIR/target/release/javalens.exe"
    elif [ -f "$ROOT_DIR/target/release/javalens" ]; then
        BINARY="$ROOT_DIR/target/release/javalens"
    else
        echo "❌ Build failed: no binary produced. Check build.sh output above."
        exit 1
    fi
fi

echo "========================================================"
echo "    🚀 Launching JavaLens Desktop App (Tauri 2.0)       "
echo "========================================================"
echo "Target Project : $PROJECT_PATH"
echo "Binary         : $BINARY"
echo ""

"$BINARY" "$PROJECT_PATH"
