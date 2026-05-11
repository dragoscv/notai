<#
.SYNOPSIS
  Generate a Tauri 2 updater signing keypair for Notai desktop.

.DESCRIPTION
  Wraps `pnpm tauri signer generate` and prints the values you need to
  paste into GitHub Actions secrets and apps/desktop/src-tauri/tauri.conf.json.

  Run once. The PRIVATE key never leaves your machine; only the
  base64-encoded public key (already inlined in tauri.conf.json) and the
  private key + password (only as GH secrets) are needed.

  See docs/desktop-updater.md for the full procedure.

.EXAMPLE
  pwsh apps/desktop/scripts/generate-updater-key.ps1
#>

param(
  [string] $OutputDir = (Join-Path $HOME ".tauri-keys/notai")
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $OutputDir)) {
  New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$keyPath = Join-Path $OutputDir "notai-updater.key"
if (Test-Path $keyPath) {
  Write-Host "FATAL: a key already exists at $keyPath." -ForegroundColor Red
  Write-Host "Refusing to overwrite. Delete it first if you really want to rotate." -ForegroundColor Red
  exit 1
}

Write-Host "Generating Tauri updater keypair at $keyPath..." -ForegroundColor Cyan
Push-Location (Resolve-Path "$PSScriptRoot/..")
try {
  pnpm tauri signer generate -w $keyPath
} finally {
  Pop-Location
}

if (-not (Test-Path $keyPath)) {
  Write-Host "Tauri did not produce a key file. Aborting." -ForegroundColor Red
  exit 1
}

$pubPath = "$keyPath.pub"
$privateKey = Get-Content -Raw -Path $keyPath
$publicKey  = Get-Content -Raw -Path $pubPath

Write-Host ""
Write-Host "==== PUBLIC KEY (already in tauri.conf.json — verify it matches) ====" -ForegroundColor Yellow
Write-Host $publicKey
Write-Host ""
Write-Host "==== PRIVATE KEY (paste into GH secret TAURI_SIGNING_PRIVATE_KEY) ====" -ForegroundColor Yellow
Write-Host $privateKey
Write-Host ""
Write-Host "Set both secrets:" -ForegroundColor Cyan
Write-Host "  gh secret set TAURI_SIGNING_PRIVATE_KEY < `"$keyPath`"" -ForegroundColor Cyan
Write-Host "  gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD" -ForegroundColor Cyan
Write-Host ""
Write-Host "DO NOT commit $keyPath. The private key is only useful when paired" -ForegroundColor Red
Write-Host "with the password you chose during generation — keep them in your" -ForegroundColor Red
Write-Host "password manager AS WELL as in GitHub secrets." -ForegroundColor Red
