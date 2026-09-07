param([string]$Address)

$ErrorActionPreference = 'Stop'
if (-not $Address) {
    $route = Get-NetRoute -AddressFamily IPv4 -DestinationPrefix '0.0.0.0/0' |
        Sort-Object RouteMetric | Select-Object -First 1
    $Address = Get-NetIPAddress -AddressFamily IPv4 -InterfaceIndex $route.InterfaceIndex |
        Where-Object { $_.AddressState -eq 'Preferred' } |
        Select-Object -First 1 -ExpandProperty IPAddress
}
$parsedAddress = $null
if (-not [System.Net.IPAddress]::TryParse($Address, [ref]$parsedAddress) -or
    $parsedAddress.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork) {
    throw 'Pass the PC Wi-Fi/Ethernet IPv4 address with -Address.'
}
try {
    Invoke-WebRequest -UseBasicParsing "http://${Address}:8000/api/v1/health/" -TimeoutSec 5 | Out-Null
} catch {
    throw "The API is not reachable at ${Address}:8000. Start Docker and add $Address to ALLOWED_HOSTS in apps/api/.env, then run docker compose up -d --no-deps api."
}

$previousHost = $env:REACT_NATIVE_PACKAGER_HOSTNAME
Push-Location -LiteralPath (Join-Path $PSScriptRoot '..')
try {
    $env:REACT_NATIVE_PACKAGER_HOSTNAME = $Address
    & pnpm.cmd --filter mobile surfaces:build
    if ($LASTEXITCODE -ne 0) { throw 'Desktop surface bundling failed.' }
    Write-Host "Android preview: exp://${Address}:8081"
    Write-Host 'Use Expo Go for SDK 53. Keep the phone and PC on the same network.'
    & pnpm.cmd --filter mobile exec expo start --lan --go --port 8081
    if ($LASTEXITCODE -ne 0) { throw "Metro exited with code $LASTEXITCODE." }
} finally {
    $env:REACT_NATIVE_PACKAGER_HOSTNAME = $previousHost
    Pop-Location
}
