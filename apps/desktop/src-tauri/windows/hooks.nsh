; Notai NSIS installer hooks
; Silently uninstall any previously installed version before fresh install.
; Reduces install/finish-page confirmations to the minimum the stock template allows.

!macro NSIS_HOOK_PREINSTALL
  ; Silently remove the previous install if any.
  ; Tauri registers the uninstaller in HKCU (currentUser mode) under the bundle identifier.
  ReadRegStr $R0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${BUNDLEID}" "QuietUninstallString"
  ${If} $R0 == ""
    ReadRegStr $R0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${BUNDLEID}" "UninstallString"
  ${EndIf}
  ${If} $R0 == ""
    ; Try HKLM in case a previous build was perMachine.
    ReadRegStr $R0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${BUNDLEID}" "QuietUninstallString"
    ${If} $R0 == ""
      ReadRegStr $R0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${BUNDLEID}" "UninstallString"
    ${EndIf}
  ${EndIf}
  ${If} $R0 != ""
    ; Strip surrounding quotes if present, then run silently and wait for completion.
    ; _?=$INSTDIR keeps the call synchronous so we can install on top.
    ClearErrors
    ExecWait '$R0 /S _?=$INSTDIR' $R1
  ${EndIf}
!macroend
