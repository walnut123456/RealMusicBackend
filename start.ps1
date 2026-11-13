$backendRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverPath = Join-Path $backendRoot 'server.js'
$pidFile = Join-Path $backendRoot 'backend.pid'
$port = if ($env:PORT) { [int]$env:PORT } else { 3000 }

function Test-BackendPort([int]$targetPort) {
    $client = [System.Net.Sockets.TcpClient]::new()
    try {
        $client.Connect('127.0.0.1', $targetPort)
        return $true
    } catch {
        return $false
    } finally {
        $client.Dispose()
    }
}

if (Test-BackendPort $port) {
    throw "Port $port is already in use. Check the existing service before starting another one."
}

if (-not (Test-Path -LiteralPath (Join-Path $backendRoot 'node_modules'))) {
    throw 'Dependencies are missing. Run pnpm install --frozen-lockfile in the backend directory first.'
}

$node = (Get-Command node -ErrorAction Stop).Source
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$stdoutLog = Join-Path $backendRoot "backend.$timestamp.stdout.log"
$stderrLog = Join-Path $backendRoot "backend.$timestamp.stderr.log"
$process = Start-Process -FilePath $node -ArgumentList ('"{0}"' -f $serverPath) `
    -WorkingDirectory $backendRoot -RedirectStandardOutput $stdoutLog `
    -RedirectStandardError $stderrLog -WindowStyle Hidden -PassThru

for ($attempt = 0; $attempt -lt 40; $attempt++) {
    Start-Sleep -Milliseconds 250
    $process.Refresh()
    if ($process.HasExited) {
        throw "Backend exited with code $($process.ExitCode). See $stderrLog"
    }
    if (Test-BackendPort $port) {
        Set-Content -LiteralPath $pidFile -Value $process.Id
        Write-Output "Real Music API started on port $port (PID $($process.Id))."
        Write-Output "Logs: $stdoutLog and $stderrLog"
        exit 0
    }
}

throw "Backend did not open port $port within 10 seconds. See $stderrLog"
