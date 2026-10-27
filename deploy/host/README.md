# Running JQZZ on the host

One Java process serves the API, the live socket and the built frontend, behind the
Tailscale funnel at `/jqzz` (the funnel strips the prefix; the frontend is built to ask for
`/jqzz/...`).

On the host, everything lives in `C:\JQZZ`:

| | |
|---|---|
| `jdk\` | a Temurin 21 runtime, unpacked from the zip; nothing installed system-wide |
| `jqzz.jar` | the backend (`mvnw package`) |
| `web\` | the built frontend |
| `data\` | the H2 database |
| `logs\` | launcher and server output |

The scheduled task **JQZZ Server** (`Register-Task.ps1`) runs `Start-Jqzz.ps1` at boot and
every three minutes; it starts the server on port 7400 when it isn't answering.

## Updating

```powershell
# backend
cd backend/jqzz; ./mvnw package
# frontend, built for the /jqzz prefix
cd frontend; $env:VITE_API_BASE_URL='/jqzz'; npx vite build --base=/jqzz/ --outDir <out>
```

Copy the jar to `C:\JQZZ\jqzz-new.jar` and run `Swap-Jqzz.ps1`; copy `<out>` over `C:\JQZZ\web`
(no restart needed for the frontend alone). `Restart-Jqzz.ps1` restarts without swapping.

Build the frontend from PowerShell: Git Bash rewrites `/jqzz/` into a Windows path.
