# ==============================================================================
#  JavaLens - 1-Click Launch Script (PowerShell / Windows)
# ==============================================================================
param (
    [string]$ProjectPath = "fixtures/sample-petclinic",
    [int]$Port = 3030
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
Write-Host "              🚀 Launching JavaLens Server              " -ForegroundColor Magenta
Write-Host "========================================================" -ForegroundColor Magenta
Write-Host "Target Project : $ProjectPath" -ForegroundColor Cyan
Write-Host "Web Interface  : http://localhost:$Port" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the server.`n" -ForegroundColor DarkGray

# Open browser after a brief delay
Start-Job -ScriptBlock {
    param($url)
    Start-Sleep -Seconds 2
    Start-Process $url
} -ArgumentList "http://localhost:$Port" | Out-Null

$env:PORT = "$Port"
& $Binary $ProjectPath
