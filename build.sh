#!/usr/bin/env bash
# ==============================================================================
#  JavaLens - Automated Build Script (Linux / macOS / Bash)
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
echo -e "${CYAN}           JavaLens - Build System Installer            ${NC}"
echo -e "${CYAN}========================================================${NC}"
echo -e "Project Directory: $ROOT_DIR\n"

# 1. Prerequisites Check
echo -e "${CYAN}[1/3] Checking Prerequisites (Node.js, npm, Rust Cargo)...${NC}"

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

echo -e "${GREEN}✓ Node.js $(node -v) & Cargo $(cargo --version) detected.${NC}\n"

# 2. Build Frontend
echo -e "${CYAN}[2/3] Building Frontend (React + Vite)...${NC}"
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

echo -e "${GREEN}✓ Frontend build completed successfully -> frontend/dist${NC}\n"

# 3. Build Backend
cd "$ROOT_DIR"
echo -e "${CYAN}[3/3] Compiling Backend Binary (Cargo Release Mode)...${NC}"
cargo build --release

if [ -f "target/release/javalens.exe" ]; then
    BINARY_PATH="target/release/javalens.exe"
elif [ -f "target/release/javalens" ]; then
    BINARY_PATH="target/release/javalens"
else
    echo -e "${RED}[ERROR] Compiled binary not found at target/release/javalens${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Backend binary compiled successfully: $BINARY_PATH${NC}\n"

echo -e "${GREEN}========================================================${NC}"
echo -e "${GREEN}              BUILD COMPLETED SUCCESSFULLY!             ${NC}"
echo -e "${GREEN}========================================================${NC}"
echo -e "\nTo start JavaLens Desktop Application, run:"
echo -e "  ${CYAN}./run.sh${NC} or ${CYAN}./$BINARY_PATH <path-to-java-project>${NC}\n"
