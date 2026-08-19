# ==============================================================================
#  JavaLens - 1-Click Desktop App Launcher (PowerShell / Windows)
# ==============================================================================
param (
    [string]$ProjectPath = "fixtures/sample-petclinic"
)

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $RootDir

$Binary = Join-Path $RootDir "target\release\javalens.exe"
$FrontendDist = Join-Path $RootDir "frontend\dist\index.html"

# Auto-build if not built yet
if (-not (Test-Path $Binary) -or -not (Test-Path $FrontendDist)) {
    Write-Host "⚠️ Application not built yet. Running build.ps1 first..." -ForegroundColor Yellow
    & (Join-Path $RootDir "build.ps1")
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Build failed. Aborting launch." -ForegroundColor Red
        exit $LASTEXITCODE
    }
}

Write-Host "========================================================" -ForegroundColor Magenta
Write-Host "         🚀 Launching JavaLens Desktop App              " -ForegroundColor Magenta
Write-Host "========================================================" -ForegroundColor Magenta
Write-Host "Target Project : $ProjectPath" -ForegroundColor Cyan
Write-Host "Framework      : Tauri 2.0 Native Desktop Window`n" -ForegroundColor Green

& $Binary $ProjectPath
