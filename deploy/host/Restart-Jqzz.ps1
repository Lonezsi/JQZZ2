# Stop the running server; the task starts it again with the current launcher.
$jar = 'C:\JQZZ\jqzz.jar'
$running = Get-CimInstance Win32_Process -Filter "Name='java.exe'" | Where-Object { $_.CommandLine -like "*$jar*" }
foreach ($p in $running) { Stop-Process -Id $p.ProcessId -Force }
Start-Sleep -Seconds 2
schtasks /Run /TN "JQZZ Server" | Out-Null
"restarted ($(@($running).Count) stopped)"
