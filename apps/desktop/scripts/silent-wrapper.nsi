; Silent-wrapper installer for Notai.
;
; When double-clicked, this exe:
;   1. Extracts the embedded Tauri setup to %TEMP%
;   2. Runs it with /S (fully silent)
;   3. Exits
;
; No UI is shown at any point thanks to `SilentInstall silent`.
; Invoked from scripts/build-silent.ps1 after `pnpm build`.

Unicode true
SilentInstall silent
RequestExecutionLevel user

!define APP_NAME "Notai"
!define APP_VERSION "0.1.0"

Name "${APP_NAME} ${APP_VERSION}"
OutFile "${OUT_FILE}"
Icon "${ICON_FILE}"

VIProductVersion "${APP_VERSION}.0"
VIAddVersionKey "ProductName" "${APP_NAME}"
VIAddVersionKey "FileDescription" "${APP_NAME} Silent Installer"
VIAddVersionKey "FileVersion" "${APP_VERSION}"
VIAddVersionKey "ProductVersion" "${APP_VERSION}"
VIAddVersionKey "LegalCopyright" ""

Section
    SetOutPath "$PLUGINSDIR"
    File /oname=notai-setup.exe "${INNER_SETUP}"
    ExecWait '"$PLUGINSDIR\notai-setup.exe" /S'

    ; Launch the installed app so the user sees that install finished.
    ; Tauri per-user NSIS install drops the exe here:
    StrCpy $0 "$LOCALAPPDATA\${APP_NAME}\notai-desktop.exe"
    IfFileExists "$0" 0 +2
        Exec '"$0"'
SectionEnd
