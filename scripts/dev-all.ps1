$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot

# Dynamically get the current Wi-Fi or Ethernet IPv4 address
$ipV4 = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias 'Wi-Fi', 'Ethernet' -ErrorAction SilentlyContinue | Where-Object { $_.PrefixOrigin -ne 'WellKnown' -and $_.IPAddress -like '*.*.*.*' }).IPAddress | Select-Object -First 1

if (-not $ipV4) {
    # Fallback if no specific interface matches
    $ipV4 = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.PrefixOrigin -ne 'WellKnown' -and $_.IPAddress -Match "^192\.|^172\.|^10\." }).IPAddress | Select-Object -First 1
}

if ($ipV4) {
    Write-Host "Detected Local IP: $ipV4"
    # Update the .env file in the mobile app directory
    $envPath = "$repoRoot\ann-yoddha-mobile\.env"
    "EXPO_PUBLIC_BACKEND_URL=http://$($ipV4):8000" | Out-File -FilePath $envPath -Encoding utf8
    Write-Host "Updated mobile .env with EXPO_PUBLIC_BACKEND_URL=http://$($ipV4):8000"
} else {
    Write-Host "Could not detect local IP. Ensure you are connected to a network." -ForegroundColor Red
}

function Start-AppWindow {
    param(
        [string]$Title,
        [string]$Command
    )

    $startup = @(
        "-NoExit",
        "-ExecutionPolicy", "Bypass",
        "-Command",
        "`$Host.UI.RawUI.WindowTitle = '$Title'; $Command"
    )

    Start-Process powershell -ArgumentList $startup | Out-Null
}

Start-AppWindow -Title "Ann Yoddha Backend" -Command "Set-Location '$repoRoot\ann_yoddha_backend'; .\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
Start-AppWindow -Title "Ann Yoddha Web" -Command "Set-Location '$repoRoot\ann-yoddha-harvest-help'; npm run dev -- --host 0.0.0.0 --port 5173"
Start-AppWindow -Title "Ann Yoddha Mobile" -Command "Set-Location '$repoRoot\ann-yoddha-mobile'; npx expo start --lan -c"

Write-Host "Started backend, web, and mobile in separate terminals."
if ($ipV4) {
    Write-Host "Backend: http://$($ipV4):8000"
    Write-Host "Web: http://$($ipV4):5173"
}
