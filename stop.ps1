$backendRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile = Join-Path $backendRoot 'backend.pid'

if (-not (Test-Path -LiteralPath $pidFile)) {
    Write-Output 'No backend.pid file was found.'
    exit 0
}

$backendPid = [int](Get-Content -LiteralPath $pidFile -Raw).Trim()
$process = Get-Process -Id $backendPid -ErrorAction SilentlyContinue
if ($process) {
    Stop-Process -Id $backendPid
    $process.WaitForExit(5000)
    Write-Output "Stopped Pulse Music API (PID $backendPid)."
}

Remove-Item -LiteralPath $pidFile -Force
