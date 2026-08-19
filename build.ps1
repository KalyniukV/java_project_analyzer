# ==============================================================================
#  JavaLens - Tauri 2.0 Desktop App Build Script (PowerShell / Windows)
# ==============================================================================
# Builds the Tauri 2.0 native desktop application (NO browser/web server).
# ==============================================================================

$ErrorActionPreference = "Stop"

function Write-Step ($message) {
    Write-Host "`n========================================================" -ForegroundColor Cyan
    Write-Host "  $message" -ForegroundColor Cyan
    Write-Host "========================================================" -ForegroundColor Cyan
}

function Write-Success ($message) {
    Write-Host " [SUCCESS] $message" -ForegroundColor Green
}

function Write-Warn ($message) {
    Write-Host " [WARN] $message" -ForegroundColor Yellow
}

function Write-Err ($message) {
    Write-Host " [ERROR] $message" -ForegroundColor Red
}

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $RootDir

Write-Host "========================================================" -ForegroundColor Magenta
Write-Host "     JavaLens - Tauri 2.0 Desktop App Build System      " -ForegroundColor Magenta
Write-Host "========================================================" -ForegroundColor Magenta
Write-Host "Project Directory: $RootDir`n"

# ------------------------------------------------------------------------------
# 1. Environment & Prerequisites Verification
# ------------------------------------------------------------------------------
Write-Step "1/3: Checking Prerequisites (Node.js, npm, Rust Cargo)"

# Check for local portable Node.js if system node is missing
$LocalNodeDir = Join-Path $RootDir ".tools\node"
if (Test-Path $LocalNodeDir) {
    $env:PATH = "$LocalNodeDir;$env:PATH"
    Write-Host " Found local Node.js runtime in .tools/node" -ForegroundColor DarkGray
}

# Verify Node.js & npm
$NodeInstalled = $false
try {
    $NodeVersion = (& node -v 2>$null)
    $NpmVersion = (& npm -v 2>$null)
    if ($NodeVersion) {
        $NodeInstalled = $true
        Write-Success "Node.js $NodeVersion and npm $NpmVersion detected."
    }
} catch {
    $NodeInstalled = $false
}

if (-not $NodeInstalled) {
    Write-Err "Node.js was not found in PATH!"
    Write-Host " Please install Node.js (v18+) from https://nodejs.org and re-run this script." -ForegroundColor Yellow
    exit 1
}

# Verify Rust & Cargo
$CargoInstalled = $false
try {
    $CargoVersion = (& cargo --version 2>$null)
    if ($CargoVersion) {
        $CargoInstalled = $true
        Write-Success "Rust & $CargoVersion detected."
    }
} catch {
    $CargoInstalled = $false
}

if (-not $CargoInstalled) {
    Write-Err "Rust Cargo was not found in PATH!"
    Write-Host " Please install Rust from https://rustup.rs and re-run this script." -ForegroundColor Yellow
    exit 1
}

# ------------------------------------------------------------------------------
# 2. Build Frontend (React + Vite + Tailwind + XYFlow)
# ------------------------------------------------------------------------------
Write-Step "2/3: Building Frontend (React + TypeScript + Vite)"

$FrontendDir = Join-Path $RootDir "frontend"
Set-Location $FrontendDir

if (-not (Test-Path (Join-Path $FrontendDir "node_modules"))) {
    Write-Host " Installing frontend dependencies (npm install)..." -ForegroundColor DarkGray
    & npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Err "npm install failed!"
        exit $LASTEXITCODE
    }
}

Write-Host " Compiling frontend assets (npm run build)..." -ForegroundColor DarkGray
& npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Err "Frontend compilation failed!"
    exit $LASTEXITCODE
}

$DistDir = Join-Path $FrontendDir "dist"
if (Test-Path (Join-Path $DistDir "index.html")) {
    Write-Success "Frontend build completed successfully -> frontend/dist"
} else {
    Write-Err "frontend/dist/index.html was not generated!"
    exit 1
}

Set-Location $RootDir

# ------------------------------------------------------------------------------
# 3. Build Tauri Desktop Backend (Rust Release Binary)
# ------------------------------------------------------------------------------
Write-Step "3/3: Compiling Tauri Desktop Binary (Cargo Release Mode)"

# IMPORTANT: Remove old binary FIRST so stale Axum-based binaries are never used
$OldBinary = Join-Path $RootDir "target\release\javalens.exe"
if (Test-Path $OldBinary) {
    Write-Warn "Removing old binary to ensure clean Tauri build..."
    Remove-Item $OldBinary -Force
}

Write-Host " Building Rust crates in release mode (cargo build --release)..." -ForegroundColor DarkGray
& cargo build --release

if ($LASTEXITCODE -ne 0) {
    Write-Err "Cargo release compilation failed!"
    exit $LASTEXITCODE
}

$BinaryName = if ($IsWindows -or $env:OS -like "*Windows*") { "javalens.exe" } else { "javalens" }
$BinaryPath = Join-Path $RootDir "target\release\$BinaryName"

if (Test-Path $BinaryPath) {
    Write-Success "Tauri desktop binary compiled: target\release\$BinaryName"
} else {
    Write-Err "Compiled binary not found at: $BinaryPath"
    exit 1
}

# ------------------------------------------------------------------------------
# Completion Summary
# ------------------------------------------------------------------------------
Write-Host "`n========================================================" -ForegroundColor Green
Write-Host "     BUILD COMPLETED SUCCESSFULLY (Tauri 2.0 Desktop)   " -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host "`nTo launch JavaLens Desktop Application:"
Write-Host "  1. Interactive launcher:   .\run.ps1" -ForegroundColor Cyan
Write-Host "  2. Specific project:       .\run.ps1 -ProjectPath 'C:\Projects\MyApp'" -ForegroundColor Cyan
Write-Host "  3. Sample demo:            .\target\release\$BinaryName fixtures\sample-petclinic`n" -ForegroundColor Cyan
