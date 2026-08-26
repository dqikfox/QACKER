$shell   = New-Object -ComObject WScript.Shell
$desktop = [System.Environment]::GetFolderPath('Desktop')
$lnk     = $shell.CreateShortcut("$desktop\QACKER.lnk")

$lnk.TargetPath       = 'C:\Users\KING\projects\qacker\start-qacker.bat'
$lnk.WorkingDirectory = 'C:\Users\KING\projects\qacker'
$lnk.Description      = 'QACKER - CyberStrike Arsenal'
$lnk.IconLocation     = 'C:\Windows\System32\cmd.exe,0'
$lnk.WindowStyle      = 1
$lnk.Save()

Write-Host "Shortcut created at: $desktop\QACKER.lnk"
