#!/usr/bin/env pwsh
# Build the standard Tauri NSIS installer, then wrap it in a silent launcher.
# Produces: Notai_<version>_x64-silent-setup.exe
$ErrorActionPreference = "Stop"

$appDir = Split-Path -Parent $PSScriptRoot
$tauri = Join-Path $appDir "src-tauri"
$bundleDir = Join-Path $tauri "target\release\bundle\nsis"

# 1. Build the normal installer (delegates to dev.ps1 which sets up MSVC env).
Write-Host "==> Building Tauri installer..." -ForegroundColor Cyan
& (Join-Path $PSScriptRoot "dev.ps1") build
if ($LASTEXITCODE -ne 0) { throw "tauri build failed ($LASTEXITCODE)" }

# 2. Find the produced setup exe.
$inner = Get-ChildItem -Path $bundleDir -Filter "*-setup.exe" -Exclude "*silent*" |
    Where-Object { $_.Name -notlike "*silent*" } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
if (-not $inner) { throw "No Tauri setup exe found in $bundleDir" }
Write-Host "Inner setup: $($inner.FullName)"

# 3. Locate Tauri's cached NSIS toolchain.
$makensis = "$env:LOCALAPPDATA\tauri\NSIS\makensis.exe"
if (-not (Test-Path $makensis)) {
    $makensis = Get-ChildItem -Path "$env:LOCALAPPDATA\tauri" -Recurse -Filter "makensis.exe" -ErrorAction SilentlyContinue -Depth 4 |
        Select-Object -First 1 -ExpandProperty FullName
}
if (-not $makensis) { throw "makensis.exe not found. Run a normal tauri build first so Tauri caches NSIS." }

# 4. Paths for the wrapper.
$nsi = Join-Path $PSScriptRoot "silent-wrapper.nsi"
$icon = Join-Path $tauri "icons\icon.ico"
$outName = $inner.Name -replace "-setup\.exe$", "-silent-setup.exe"
$out = Join-Path $bundleDir $outName

# 5. Compile the silent wrapper.
Write-Host "==> Building silent wrapper -> $outName" -ForegroundColor Cyan
$pkg = Get-Content (Join-Path $appDir "package.json") -Raw | ConvertFrom-Json
& $makensis `
    "/DAPP_VERSION=$($pkg.version)" `
    "/DOUT_FILE=$out" `
    "/DINNER_SETUP=$($inner.FullName)" `
    "/DICON_FILE=$icon" `
    $nsi
if ($LASTEXITCODE -ne 0) { throw "makensis failed ($LASTEXITCODE)" }

Write-Host ""
Write-Host "Silent installer ready:" -ForegroundColor Green
Write-Host "  $out"
