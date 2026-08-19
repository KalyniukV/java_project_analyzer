@echo off
setlocal enabledelayedexpansion

set "ROOT_DIR=%~dp0"
cd /d "%ROOT_DIR%"

set "PROJECT_PATH=%~1"
if "%PROJECT_PATH%"=="" (
    set "PROJECT_PATH=fixtures\sample-petclinic"
)

set "BINARY=%ROOT_DIR%target\release\javalens.exe"
set "FRONTEND_DIST=%ROOT_DIR%frontend\dist\index.html"

if not exist "%BINARY%" (
    echo [INFO] JavaLens binary not found. Running build.bat first...
    call build.bat
    if %errorlevel% neq 0 exit /b %errorlevel%
)

if not exist "%FRONTEND_DIST%" (
    echo [INFO] Frontend assets not found. Running build.bat first...
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
