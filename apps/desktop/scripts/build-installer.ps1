# Builds the wrapped Notai installer locally for testing.
#
# Steps:
#   1. Build the standard Tauri NSIS setup (via dev.ps1 build).
#   2. Wrap it with installer-wrapper.nsi so the wrapper becomes the
#      single setup.exe (no separate "silent" file).
#   3. Optionally re-sign with `tauri signer sign` so the auto-updater
#      signature stays valid (matches CI behavior).
#
# Usage:
#   pwsh apps/desktop/scripts/build-installer.ps1
#   pwsh apps/desktop/scripts/build-installer.ps1 -Sign
#
# Env vars (only needed with -Sign):
#   TAURI_SIGNING_PRIVATE_KEY
#   TAURI_SIGNING_PRIVATE_KEY_PASSWORD

[CmdletBinding()]
param(
    [switch]$Sign,
    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path "$PSScriptRoot/../../..").Path
$appDir   = Join-Path $repoRoot 'apps/desktop'
$bundleDir = Join-Path $appDir 'src-tauri/target/release/bundle/nsis'

# 1. Build the inner Tauri setup unless told to skip.
if (-not $SkipBuild) {
    Write-Host "==> Running Tauri build (this can take a few minutes)" -ForegroundColor Cyan
    & (Join-Path $appDir 'scripts/dev.ps1') build
    if ($LASTEXITCODE -ne 0) { throw "Tauri build failed ($LASTEXITCODE)" }
}

# 2. Locate the inner setup that tauri-bundler just produced.
$inner = Get-ChildItem -Path $bundleDir -Filter '*-setup.exe' |
    Where-Object { $_.Name -notlike '*wrapped*' } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
if (-not $inner) { throw "No Tauri setup exe found in $bundleDir" }
Write-Host "Inner setup: $($inner.FullName)" -ForegroundColor Cyan

# 3. Find makensis (Tauri caches it under %LOCALAPPDATA%\tauri\NSIS).
$makensis = Join-Path $env:LOCALAPPDATA 'tauri/NSIS/makensis.exe'
if (-not (Test-Path $makensis)) {
    $makensis = Get-ChildItem -Path (Join-Path $env:LOCALAPPDATA 'tauri') `
        -Recurse -Filter 'makensis.exe' -ErrorAction SilentlyContinue -Depth 5 |
        Select-Object -First 1 -ExpandProperty FullName
}
if (-not $makensis) { throw 'makensis.exe not found. Run a Tauri Windows build first.' }

# 4. Compile the wrapper INTO a temp file, then atomically replace setup.exe.
$nsi  = Join-Path $appDir 'scripts/installer-wrapper.nsi'
$icon = Join-Path $appDir 'src-tauri/icons/icon.ico'
$pkg  = Get-Content (Join-Path $appDir 'package.json') -Raw | ConvertFrom-Json
$tmp  = Join-Path $bundleDir 'wrapped-setup.exe'

Write-Host "==> Building wrapper -> $tmp" -ForegroundColor Cyan
& $makensis `
    "/DAPP_VERSION=$($pkg.version)" `
    "/DOUT_FILE=$tmp" `
    "/DINNER_SETUP=$($inner.FullName)" `
    "/DICON_FILE=$icon" `
    $nsi
if ($LASTEXITCODE -ne 0) { throw "makensis failed ($LASTEXITCODE)" }

# 5. Replace the original setup.exe with the wrapper.
Move-Item -Force $tmp $inner.FullName
Write-Host "Wrapper now at: $($inner.FullName)" -ForegroundColor Green

# 6. Optionally re-sign so the .sig matches the new exe (auto-updater).
if ($Sign) {
    if (-not $env:TAURI_SIGNING_PRIVATE_KEY -or -not $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD) {
        throw 'Set TAURI_SIGNING_PRIVATE_KEY and TAURI_SIGNING_PRIVATE_KEY_PASSWORD to use -Sign.'
    }
    Write-Host '==> Re-signing setup.exe' -ForegroundColor Cyan
    Push-Location $appDir
    try {
        pnpm exec tauri signer sign `
            -k $env:TAURI_SIGNING_PRIVATE_KEY `
            -p $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD `
            $inner.FullName
        if ($LASTEXITCODE -ne 0) { throw "signer sign failed ($LASTEXITCODE)" }
    } finally {
        Pop-Location
    }
}

Write-Host "Done." -ForegroundColor Green
