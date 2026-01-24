$WshShell = New-Object -ComObject WScript.Shell
$StartupPath = [Environment]::GetFolderPath('Startup')
$ShortcutPath = Join-Path $StartupPath "ClawdBot.lnk"
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = "c:\Users\user\.gemini\antigravity\playground\charged-tyson\start-discord-bot.bat"
$Shortcut.WorkingDirectory = "c:\Users\user\.gemini\antigravity\playground\charged-tyson"
$Shortcut.WindowStyle = 7  # Minimized
$Shortcut.Save()
Write-Host "Created startup shortcut at: $ShortcutPath"
