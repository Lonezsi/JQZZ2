# Register "JQZZ Server" the way "Foyer Server" is registered.
#
# Read off the live task rather than guessed at, because the settings that matter here are
# the ones schtasks cannot reach and Windows defaults wrongly:
#
#   DisallowStartIfOnBatteries  False   a run missed on battery is delayed, not dropped
#   StopIfGoingOnBatteries      False   and a running one is not killed when the mains go
#   StartWhenAvailable          True    a missed run happens late instead of never
#   ExecutionTimeLimit          PT0S    no limit: this task IS the server process
#   MultipleInstances           IgnoreNew
#
# Two triggers, also matching: at boot, and every three minutes for ever. The script is
# both launcher and watchdog, so the repeat is what brings the site back, and on a run
# where it is already answering the script exits immediately and says nothing.

$ErrorActionPreference = 'Stop'

$Name   = 'JQZZ Server'
$Script = 'C:\JQZZ\Start-Jqzz.ps1'

if (-not (Test-Path $Script)) { throw "no launcher at $Script" }

if (Get-ScheduledTask -TaskName $Name -ErrorAction SilentlyContinue) {
    Write-Output "REFUSED: a task called '$Name' already exists. Nothing changed."
    exit 1
}

$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Script`""

$atBoot = New-ScheduledTaskTrigger -AtStartup

# Repeating for ever. A daily trigger with a three minute repetition and an unbounded
# duration is how a "every three minutes, always" schedule is expressed here.
$repeat = New-ScheduledTaskTrigger -Once -At (Get-Date).Date `
    -RepetitionInterval (New-TimeSpan -Minutes 3)

$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount `
    -RunLevel Highest

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit ([TimeSpan]::Zero)

Register-ScheduledTask -TaskName $Name -Action $action -Trigger @($atBoot, $repeat) `
    -Principal $principal -Settings $settings `
    -Description 'JQZZ, the quiz app. Launcher and watchdog in one.' |
    Out-Null

$t = Get-ScheduledTask -TaskName $Name
Write-Output "registered: $($t.TaskName)"
Write-Output ("  principal : {0} / {1}" -f $t.Principal.UserId, $t.Principal.RunLevel)
Write-Output ("  battery   : disallow={0} stopOnBattery={1} catchUp={2}" -f `
    $t.Settings.DisallowStartIfOnBatteries, $t.Settings.StopIfGoingOnBatteries, `
    $t.Settings.StartWhenAvailable)
Write-Output ("  timeLimit : {0}" -f $t.Settings.ExecutionTimeLimit)
foreach ($tr in $t.Triggers) {
    Write-Output ("  trigger   : {0} every={1}" -f $tr.CimClass.CimClassName, `
        $tr.Repetition.Interval)
}
