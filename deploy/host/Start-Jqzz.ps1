# Start JQZZ on the host, and keep it started. Launcher and watchdog in one, the same shape
# as Start-Foyer.ps1: run every few minutes; if it answers, exit; if not, clear out any
# wedged copy and start one.
#
# Everything lives in C:\JQZZ: the Java runtime in jdk\, the app in jqzz.jar, the built
# frontend in web\, the H2 database in data\ (relative to the working directory).
#
# Browsers are told to check for a newer copy of every file (no-cache): without it they
# guessed from the file's age and kept showing the previous build after an update. The
# check is a cheap 304 when nothing changed.
#
# Behind the Tailscale funnel at /jqzz. The funnel strips that prefix, so the app answers at
# its root here, and the frontend was built to ask for /jqzz/... in the browser.

$ErrorActionPreference = 'Stop'

$Root   = 'C:\JQZZ'
$Java   = Join-Path $Root 'jdk\bin\java.exe'
$Jar    = Join-Path $Root 'jqzz.jar'
$LogDir = Join-Path $Root 'logs'
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$Log    = Join-Path $LogDir 'host-jqzz.log'
$Port   = 7400
$LogCap = 512KB

function Roll($path) {
    if (-not (Test-Path $path)) { return }
    if ((Get-Item $path).Length -lt $LogCap) { return }
    Move-Item -Path $path -Destination ($path + '.1') -Force -ErrorAction SilentlyContinue
}

function Say($text) {
    Roll $Log
    $line = "{0}  {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $text
    Add-Content -Path $Log -Value $line -Encoding utf8
}

# Answering is the test: the front page, which is a static file, so it costs nothing.
# Spring takes a while to come up, so a run that finds it starting leaves it alone (below).
function Test-Serving {
    foreach ($attempt in 1..2) {
        try {
            $r = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/index.html" -UseBasicParsing -TimeoutSec 8
            if ($r.StatusCode -eq 200) { return $true }
        } catch { }
        if ($attempt -lt 2) { Start-Sleep -Seconds 3 }
    }
    return $false
}

function Get-JqzzProcesses {
    Get-CimInstance Win32_Process -Filter "Name='java.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -and $_.CommandLine -like "*$Jar*" }
}

if (Test-Serving) { exit 0 }

$running = Get-JqzzProcesses
if ($running) {
    # Spring Boot needs the better part of a minute on this machine. A copy younger than
    # three minutes is still starting, not wedged.
    $young = @($running | Where-Object { ((Get-Date) - $_.CreationDate).TotalMinutes -lt 3 })
    if ($young.Count) { exit 0 }
    Say ("not answering but {0} process(es) present; stopping them" -f @($running).Count)
    foreach ($p in $running) {
        try { Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop } catch { }
    }
    Start-Sleep -Seconds 3
}

Say 'starting'
$out = Join-Path $LogDir 'host-jqzz-out.log'
Roll $out
Set-Location $Root

# Not fatal: see the long note in Start-Foyer.ps1. A line on stderr must not kill this
# script, and Java writes plenty there.
$ErrorActionPreference = 'Continue'
& $Java -Xmx384m -jar $Jar `
    "--server.port=$Port" `
    '--server.address=127.0.0.1' `
    '--server.forward-headers-strategy=native' `
    '--spring.web.resources.static-locations=file:C:/JQZZ/web/' `
    '--spring.web.resources.cache.cachecontrol.no-cache=true' *>> $out
$ErrorActionPreference = 'Stop'
Say ("server exited with {0}" -f $LASTEXITCODE)
