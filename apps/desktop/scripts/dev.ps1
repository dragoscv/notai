#!/usr/bin/env pwsh
$ErrorActionPreference = "Stop"

$scriptArgs = @()
foreach ($a in $args) { $scriptArgs += [string]$a }
if ($scriptArgs.Count -eq 0) { $scriptArgs = @("dev") }

function Initialize-MsvcEnv {
    if ($env:VCINSTALLDIR -and $env:WindowsSdkDir) { return $true }
    $vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
    if (-not (Test-Path $vswhere)) {
        Write-Warning "vswhere.exe not found at $vswhere - MSVC env not loaded."
        return $false
    }
    $vsPath = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
    if (-not $vsPath) {
        Write-Warning "Visual Studio with C++ tools not found."
        return $false
    }
    $devShell = Join-Path $vsPath "Common7\Tools\Microsoft.VisualStudio.DevShell.dll"
    if (-not (Test-Path $devShell)) {
        Write-Warning "DevShell module not found at $devShell"
        return $false
    }
    Import-Module $devShell
    Enter-VsDevShell -VsInstallPath $vsPath -SkipAutomaticLocation -DevCmdArguments "-arch=x64 -host_arch=x64" | Out-Null
    return $true
}

$ok = Initialize-MsvcEnv
if (-not $ok) {
    Write-Error "Unable to initialize MSVC developer environment. Install 'Desktop development with C++' via the Visual Studio Installer."
    exit 1
}

Write-Host "DEBUG scriptArgs: $($scriptArgs -join '|')"
& pnpm exec tauri @scriptArgs
exit $LASTEXITCODE