!ifndef BUILD_UNINSTALLER
  Var MeridianExistingStartup
!endif

!macro customInit
  ReadRegStr $MeridianExistingStartup HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Meridian"
!macroend

!macro customInstall
  ; Older uninstallers removed the Run value even during an upgrade.
  ; Restore it only when it existed before this installer started.
  ${If} $MeridianExistingStartup != ""
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Meridian" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" --autostart'
  ${EndIf}
!macroend

!macro customUnInstall
  ${IfNot} ${isUpdated}
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Meridian"
  ${EndIf}
!macroend
