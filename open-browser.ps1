# QACKER - Browser opener helper
# Called by start-qacker.bat after the server starts.
# Polls /api/status until ready, then opens the dashboard.
param(
    [int]$Port = 3000,
    [int]$MaxTries = 30
)

$url = "http://localhost:$Port"

for ($i = 0; $i -lt $MaxTries; $i++) {
    try {
        $null = Invoke-WebRequest -Uri "$url/api/status" -TimeoutSec 1 -UseBasicParsing -ErrorAction Stop
        Start-Process $url
        exit 0
    } catch {
        Start-Sleep -Seconds 1
    }
}
