; Silent-wrapper installer for Notai.
;
; When double-clicked, this exe:
;   1. Extracts the embedded Tauri setup to %TEMP%
;   2. Runs it with /S (fully silent — no UI, no prompts)
;   3. Launches the installed app
;   4. Exits
;
; No UI is shown at any point thanks to `SilentInstall silent`.
; Built locally via scripts/build-silent.ps1, or in CI by the
; "Build silent installer wrapper" step in .github/workflows/release-desktop.yml.
;
; Required /D defines:
;   APP_VERSION   — e.g. 0.1.11
;   OUT_FILE      — output .exe path
;   INNER_SETUP   — path to the Tauri-produced setup.exe to embed
;   ICON_FILE     — path to .ico

Unicode true
SilentInstall silent
RequestExecutionLevel user

!define APP_NAME "Notai"
!ifndef APP_VERSION
    !define APP_VERSION "0.0.0"
!endif

Name "${APP_NAME} ${APP_VERSION}"
OutFile "${OUT_FILE}"
Icon "${ICON_FILE}"

VIProductVersion "${APP_VERSION}.0"
VIAddVersionKey "ProductName" "${APP_NAME}"
VIAddVersionKey "FileDescription" "${APP_NAME} Silent Installer"
VIAddVersionKey "FileVersion" "${APP_VERSION}"
VIAddVersionKey "ProductVersion" "${APP_VERSION}"
VIAddVersionKey "LegalCopyright" "Copyright (c) 2026 Codai"

Section
    SetOutPath "$PLUGINSDIR"
    File /oname=notai-setup.exe "${INNER_SETUP}"
    ; /S: fully silent. No prompts, no UI, no finish page.
    ExecWait '"$PLUGINSDIR\notai-setup.exe" /S'

    ; Launch the installed app so the user sees that install finished.
    ; Tauri per-user NSIS install drops the exe at:
    ;   $LOCALAPPDATA\<ProductName>\<binary>.exe
    StrCpy $0 "$LOCALAPPDATA\${APP_NAME}\notai-desktop.exe"
    IfFileExists "$0" 0 +2
        Exec '"$0"'
SectionEnd
