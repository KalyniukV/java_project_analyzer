@echo off
setlocal enabledelayedexpansion

set "ROOT_DIR=%~dp0"
cd /d "%ROOT_DIR%"

set "FORCE_BUILD=0"
if "%~1"=="--build" set "FORCE_BUILD=1"
if "%~1"=="-b" set "FORCE_BUILD=1"
if "%~2"=="--build" set "FORCE_BUILD=1"
if "%~2"=="-b" set "FORCE_BUILD=1"

set "PROJECT_PATH=%~1"
if "%PROJECT_PATH%"=="--build" set "PROJECT_PATH=%~2"
if "%PROJECT_PATH%"=="-b" set "PROJECT_PATH=%~2"
if "%PROJECT_PATH%"=="" set "PROJECT_PATH=fixtures\sample-petclinic"

set "BINARY=%ROOT_DIR%target\release\javalens.exe"
set "FRONTEND_DIST=%ROOT_DIR%frontend\dist\index.html"

if not exist "%BINARY%" set "FORCE_BUILD=1"
if not exist "%FRONTEND_DIST%" set "FORCE_BUILD=1"

if "%FORCE_BUILD%"=="1" (
    echo [INFO] Building JavaLens Desktop Application (Tauri)...
    call build.bat
    if %errorlevel% neq 0 exit /b %errorlevel%
)

echo.
echo ========================================================
echo          🚀 Launching JavaLens Desktop App (Tauri)
echo ========================================================
echo Target Project : %PROJECT_PATH%
echo.

"%BINARY%" "%PROJECT_PATH%"
