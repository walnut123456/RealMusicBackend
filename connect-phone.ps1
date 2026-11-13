$backendRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$adb = 'D:\AndroidSDK\platform-tools\adb.exe'
if (-not (Test-Path -LiteralPath $adb)) {
    $adb = (Get-Command adb -ErrorAction Stop).Source
}

$devices = @(& $adb devices | ForEach-Object {
    if ($_ -match '^([^\s]+)\s+device$' -and $Matches[1] -notmatch '^emulator-') {
        $Matches[1]
    }
})
if ($devices.Count -ne 1) {
    throw "Expected one USB-connected phone; found $($devices.Count). Connect the phone and enable USB debugging."
}

$listener = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if (-not $listener) {
    & (Join-Path $backendRoot 'start.ps1')
}

& $adb -s $devices[0] reverse tcp:3000 tcp:3000
if ($LASTEXITCODE -ne 0) {
    throw 'ADB reverse failed. Accept the USB debugging prompt on the phone and run this script again.'
}

Write-Output 'Phone connected to local Real Music API on http://127.0.0.1:3000'
Write-Output 'In Real Music: drawer > Real Music account and NetEase connection > gateway URL > http://127.0.0.1:3000.'
Write-Output 'The new client also supports direct login in the official NetEase web page.'
