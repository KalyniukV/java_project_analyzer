@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo           JavaLens - Build System Installer
echo ========================================================
echo.

set "ROOT_DIR=%~dp0"
cd /d "%ROOT_DIR%"

:: Check local tools
if exist "%ROOT_DIR%.tools\node" (
    set "PATH=%ROOT_DIR%.tools\node;%PATH%"
)

:: 1. Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH!
    echo Please install Node.js (v18+) from https://nodejs.org
    pause
    exit /b 1
)

:: 2. Check Rust Cargo
where cargo >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Rust Cargo is not installed or not in PATH!
    echo Please install Rust from https://rustup.rs
    pause
    exit /b 1
)

echo [1/3] Prerequisites verified.
echo.

:: 3. Build Frontend
echo [2/3] Building Frontend (React + Vite)...
cd /d "%ROOT_DIR%frontend"
if not exist "node_modules" (
    echo Installing frontend dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] npm install failed!
        pause
        exit /b 1
    )
)

call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Frontend build failed!
    pause
    exit /b 1
)

cd /d "%ROOT_DIR%"

:: 4. Build Rust Backend
echo.
echo [3/3] Compiling Backend Binary (Release)...
cargo build --release
if %errorlevel% neq 0 (
    echo [ERROR] Cargo compilation failed!
    pause
    exit /b 1
)

echo.
echo ========================================================
echo           BUILD COMPLETED SUCCESSFULLY!
echo ========================================================
echo.
echo Executable binary: target\release\javalens.exe
echo To launch, run: run.bat
echo.
pause
