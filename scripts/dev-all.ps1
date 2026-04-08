$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot

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
Write-Host "Backend: http://172.16.204.191:8000"
Write-Host "Web: http://172.16.204.191:5173"
