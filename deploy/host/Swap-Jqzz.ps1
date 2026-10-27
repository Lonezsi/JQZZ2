# Swap in C:\JQZZ\jqzz-new.jar: stop the running server, replace the jar, start the task.
$jar = 'C:\JQZZ\jqzz.jar'
$running = Get-CimInstance Win32_Process -Filter "Name='java.exe'" | Where-Object { $_.CommandLine -like "*$jar*" }
foreach ($p in $running) { Stop-Process -Id $p.ProcessId -Force }
Start-Sleep -Seconds 2
Move-Item 'C:\JQZZ\jqzz-new.jar' $jar -Force
schtasks /Run /TN "JQZZ Server" | Out-Null
"stopped $(@($running).Count), swapped"
