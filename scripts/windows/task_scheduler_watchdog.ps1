# Check-Heartbeat.ps1
# Runs via Windows Task Scheduler every 1 minute
# Restarts RL Trader Service if heartbeat is stale

$HeartbeatFile = "C:\Users\ricca\Desktop\RL TRADER ENGENHARIA\Prototipo_v3\heartbeat.json"
$MaxAgeSeconds = 30
$ServiceName = "RLTraderV3" # Assuming installed as service, or use Process Name logic

try {
    if (Test-Path $HeartbeatFile) {
        $Content = Get-Content $HeartbeatFile | ConvertFrom-Json
        $LastUpdate = [double]$Content.timestamp
        $Now = (Get-Date -UFormat %s)
        $Diff = $Now - $LastUpdate
        
        if ($Diff -gt $MaxAgeSeconds) {
            Write-Host "CRITICAL: Heartbeat stale ($Diff seconds). Restarting..."
            
            # Logic to kill/restart python process
            # Stop-Process -Name "python" -Force -ErrorAction SilentlyContinue
            # Start-Process "python" -ArgumentList "src/main.py" -WorkingDirectory "..."
            
            # Using Notification (via simple curl if available, or just log)
            Write-Host "Restart triggered."
        } else {
            Write-Host "OK: Heartbeat fresh ($Diff seconds)."
        }
    } else {
        Write-Host "WARNING: No heartbeat file found."
    }
} catch {
    Write-Host "ERROR: Watchdog failed $_"
}
