<#
.SYNOPSIS
    Inicializa o ATYLUS PDV como Aplicação Desktop no Windows.
.DESCRIPTION
    Inicia o backend autônomo .NET 8 em background e abre a interface gráfica em modo janela de aplicativo (App Mode).
#>

[CmdletBinding()]
param()

$root = Split-Path -Parent $PSScriptRoot

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "              Iniciando ATYLUS PDV (Desktop)              " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Verificar se o servidor já está rodando
$alreadyRunning = $false
try {
    $res = Invoke-RestMethod -Uri "http://localhost:5000/health" -TimeoutSec 1 -ErrorAction SilentlyContinue
    if ($res.status -eq "healthy") {
        $alreadyRunning = $true
        Write-Host " -> Backend já está ativo em http://localhost:5000" -ForegroundColor Green
    }
} catch {}

if (-not $alreadyRunning) {
    Write-Host "[1/2] Inicializando backend local SQLite (.NET 8)..." -ForegroundColor Yellow
    
    $sidecarExe = Join-Path $root "src-tauri\binaries\pdv-api-x86_64-pc-windows-msvc.exe"
    $apiDll = Join-Path $root "src\backend\PDV.API\bin\Debug\net8.0\PDV.API.dll"
    $dotnetExe = if (Test-Path "$env:USERPROFILE\.dotnet\dotnet.exe") { "$env:USERPROFILE\.dotnet\dotnet.exe" } else { "dotnet" }
    
    $env:PDV_DESKTOP_MODE = "1"
    $env:DOTNET_ROOT = "$env:USERPROFILE\.dotnet"

    if (Test-Path $sidecarExe) {
        Write-Host " -> Iniciando binário autônomo Self-Contained..." -ForegroundColor Cyan
        Start-Process -FilePath $sidecarExe -ArgumentList "--urls http://localhost:5000" -WindowStyle Hidden
    } elseif (Test-Path $apiDll) {
        Write-Host " -> Iniciando via .NET Runtime..." -ForegroundColor Cyan
        Start-Process -FilePath $dotnetExe -ArgumentList "`"$apiDll`" --urls http://localhost:5000" -WindowStyle Hidden
    } else {
        Write-Host " -> Compilando e iniciando API..." -ForegroundColor Cyan
        $apiProj = Join-Path $root "src\backend\PDV.API"
        Start-Process -FilePath $dotnetExe -ArgumentList "run --urls http://localhost:5000" -WorkingDirectory $apiProj -WindowStyle Hidden
    }

    # Aguardar até 10 segundos pelo healthcheck
    $healthy = $false
    for ($i = 0; $i -lt 20; $i++) {
        Start-Sleep -Milliseconds 500
        try {
            $check = Invoke-RestMethod -Uri "http://localhost:5000/health" -TimeoutSec 1 -ErrorAction SilentlyContinue
            if ($check.status -eq "healthy") {
                $healthy = $true
                break
            }
        } catch {}
    }

    if ($healthy) {
        Write-Host " -> Backend inicializado com sucesso em http://localhost:5000!" -ForegroundColor Green
    } else {
        Write-Host " -> Backend iniciando... Prosseguindo para abertura da interface." -ForegroundColor Yellow
    }
}

# 2. Abrir a Janela Desktop Nativa
Write-Host "`n[2/2] Abrindo interface gráfica do PDV em modo Janela Desktop..." -ForegroundColor Yellow

$appUrl = "http://localhost:5000"
$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"

$windowArgs = @(
    "--app=$appUrl",
    "--window-size=1400,900",
    "--window-position=50,50",
    "--enable-features=OverlayScrollbar"
)

if (Test-Path $edgePath) {
    Start-Process -FilePath $edgePath -ArgumentList $windowArgs
    Write-Host " -> Janela aberta com Microsoft Edge (App Mode)." -ForegroundColor Green
} elseif (Test-Path $chromePath) {
    Start-Process -FilePath $chromePath -ArgumentList $windowArgs
    Write-Host " -> Janela aberta com Google Chrome (App Mode)." -ForegroundColor Green
} else {
    Start-Process -FilePath $appUrl
    Write-Host " -> Aberto no navegador padrão." -ForegroundColor Green
}

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "           ATYLUS PDV pronto para uso!                    " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
