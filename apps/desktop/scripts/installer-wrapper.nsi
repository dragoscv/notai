; Installer wrapper for Notai (Windows).
;
; This .exe REPLACES the standard Tauri NSIS setup. When the user double-
; clicks it:
;   1. Extracts the embedded Tauri setup to %TEMP%\$PLUGINSDIR
;   2. Runs the inner setup with /P /R
;        /P -> Tauri's "passive" mode (skips Welcome / License / Components
;              / Reinstall / Directory / StartMenu / Finish pages and shows
;              ONLY the install progress; auto-handles previous-version
;              uninstall via Tauri's reinstall flow).
;        /R -> auto-launch the app after installation.
;   3. Exits silently.
;
; The wrapper itself shows no UI (`SilentInstall silent`); the user only
; sees Tauri's own progress dialog. No "Welcome to Notai Setup", no Next,
; no install location prompt, no finish page.
;
; The auto-updater also calls this wrapper (with /S /R from
; tauri-plugin-updater quiet mode); the wrapper still hands off to the
; inner setup with /P /R, so updates show the same minimal progress UI.
;
; Required /D defines:
;   APP_VERSION   — e.g. 0.1.12
;   OUT_FILE      — absolute output .exe path
;   INNER_SETUP   — absolute path to the Tauri-produced setup.exe to embed
;   ICON_FILE     — absolute path to .ico

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
VIAddVersionKey "FileDescription" "${APP_NAME} Installer"
VIAddVersionKey "FileVersion" "${APP_VERSION}"
VIAddVersionKey "ProductVersion" "${APP_VERSION}"
VIAddVersionKey "LegalCopyright" "Copyright (c) 2026 Codai"

Section
    SetOutPath "$PLUGINSDIR"
    File /oname=notai-setup.exe "${INNER_SETUP}"
    ; /P = Tauri passive mode (progress page only, auto-uninstalls previous
    ;      version, no other pages). /R = launch app after install.
    ExecWait '"$PLUGINSDIR\notai-setup.exe" /P /R'
SectionEnd
