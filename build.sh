#!/usr/bin/env bash
# ==============================================================================
#  JavaLens - Automated Build Script (Linux / macOS / Bash)
#  Builds the Tauri 2.0 native desktop application (NO browser/web server)
# ==============================================================================
set -e

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo -e "${CYAN}========================================================${NC}"
echo -e "${CYAN}     JavaLens - Tauri 2.0 Desktop App Build System      ${NC}"
echo -e "${CYAN}========================================================${NC}"
echo -e "Project Directory: $ROOT_DIR\n"

# ------------------------------------------------------------------------------
# 1. Prerequisites Check
# ------------------------------------------------------------------------------
echo -e "${CYAN}[1/4] Checking Prerequisites...${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}[ERROR] Node.js is not installed or not in PATH!${NC}"
    echo -e "${YELLOW}Please install Node.js (v18+) from https://nodejs.org${NC}"
    exit 1
fi

if ! command -v cargo &> /dev/null; then
    echo -e "${RED}[ERROR] Rust Cargo is not installed or not in PATH!${NC}"
    echo -e "${YELLOW}Please install Rust from https://rustup.rs${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Node.js $(node -v) & Cargo $(cargo --version) detected.${NC}"

# ------------------------------------------------------------------------------
# 2. Check Tauri system dependencies on Linux
# ------------------------------------------------------------------------------
if [[ "$(uname -s)" == "Linux" ]]; then
    echo -e "\n${CYAN}[2/4] Checking Tauri 2.0 Linux system dependencies...${NC}"

    MISSING_PKGS=()

    # Check for required packages by checking their pkg-config names
    declare -A PKG_MAP=(
        ["libwebkit2gtk-4.1-dev"]="webkit2gtk-4.1"
        ["libgtk-3-dev"]="gtk+-3.0"
        ["librsvg2-dev"]="librsvg-2.0"
        ["libssl-dev"]="openssl"
    )

    for deb_pkg in "${!PKG_MAP[@]}"; do
        pc_name="${PKG_MAP[$deb_pkg]}"
        if ! pkg-config --exists "$pc_name" 2>/dev/null; then
            MISSING_PKGS+=("$deb_pkg")
        fi
    done

    # Also check for libxdo-dev via dpkg (no .pc file)
    if ! dpkg -s libxdo-dev &>/dev/null 2>&1; then
        MISSING_PKGS+=("libxdo-dev")
    fi

    # Check for libayatana-appindicator3-dev
    if ! pkg-config --exists ayatana-appindicator3-0.1 2>/dev/null; then
        MISSING_PKGS+=("libayatana-appindicator3-dev")
    fi

    if [ ${#MISSING_PKGS[@]} -gt 0 ]; then
        echo -e "${YELLOW}⚠️  Missing Tauri 2.0 system dependencies: ${MISSING_PKGS[*]}${NC}"
        echo -e "${CYAN}Installing with apt (requires sudo)...${NC}"
        sudo apt update -qq
        sudo apt install -y "${MISSING_PKGS[@]}" build-essential curl wget file
        echo -e "${GREEN}✓ Tauri system dependencies installed successfully.${NC}"
    else
        echo -e "${GREEN}✓ All Tauri 2.0 system dependencies are present.${NC}"
    fi
else
    echo -e "\n${CYAN}[2/4] Non-Linux OS detected, skipping system dependency check.${NC}"
fi

# ------------------------------------------------------------------------------
# 3. Build Frontend (React + Vite + Tailwind + XYFlow)
# ------------------------------------------------------------------------------
echo -e "\n${CYAN}[3/4] Building Frontend (React + Vite)...${NC}"
cd "$ROOT_DIR/frontend"

if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies (npm install)..."
    npm install
fi

echo "Compiling frontend assets (npm run build)..."
npm run build

if [ ! -f "dist/index.html" ]; then
    echo -e "${RED}[ERROR] frontend/dist/index.html was not generated!${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Frontend build completed successfully -> frontend/dist${NC}"

# ------------------------------------------------------------------------------
# 4. Build Tauri Desktop Backend (Rust release binary)
# ------------------------------------------------------------------------------
cd "$ROOT_DIR"
echo -e "\n${CYAN}[4/4] Compiling Tauri Desktop Binary (Cargo Release Mode)...${NC}"

# IMPORTANT: Remove old binary FIRST so stale Axum-based binaries are never used
if [ -f "target/release/javalens" ]; then
    echo -e "${YELLOW}Removing old binary to ensure clean Tauri build...${NC}"
    rm -f "target/release/javalens"
fi
if [ -f "target/release/javalens.exe" ]; then
    rm -f "target/release/javalens.exe"
fi

cargo build --release

if [ -f "target/release/javalens.exe" ]; then
    BINARY_PATH="target/release/javalens.exe"
elif [ -f "target/release/javalens" ]; then
    BINARY_PATH="target/release/javalens"
else
    echo -e "${RED}========================================================${NC}"
    echo -e "${RED}  BUILD FAILED: Tauri desktop binary was not produced!  ${NC}"
    echo -e "${RED}========================================================${NC}"
    echo -e "${YELLOW}On Ubuntu/Debian, make sure you have all Tauri deps:${NC}"
    echo -e "${YELLOW}  sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev \\${NC}"
    echo -e "${YELLOW}    libayatana-appindicator3-dev librsvg2-dev libxdo-dev \\${NC}"
    echo -e "${YELLOW}    libssl-dev build-essential${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Tauri desktop binary compiled: $BINARY_PATH${NC}\n"

echo -e "${GREEN}========================================================${NC}"
echo -e "${GREEN}         BUILD COMPLETED SUCCESSFULLY (Tauri 2.0)       ${NC}"
echo -e "${GREEN}========================================================${NC}"
echo -e "\nTo launch JavaLens Desktop Application, run:"
echo -e "  ${CYAN}./run.sh${NC}  or  ${CYAN}./$BINARY_PATH <path-to-java-project>${NC}\n"
