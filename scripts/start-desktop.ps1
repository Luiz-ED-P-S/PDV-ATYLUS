<#
.SYNOPSIS
    Inicializa o Hórus Atylus PDV como Programa de Computador no Windows.
.DESCRIPTION
    Inicia o backend .NET Core em segundo plano e abre a aplicação na janela desktop nativa.
#>

[CmdletBinding()]
param()

$rootPath = Split-Path -Parent $PSScriptRoot

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "         Iniciando Hórus Atylus PDV (Desktop)             " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Verifica se o backend .NET está disponível
$apiPath = Join-Path $rootPath "src\backend\PDV.API"
if (Test-Path $apiPath) {
    Write-Host "[1/2] Inicializando servidor local SQLite..." -ForegroundColor Yellow
    # Caso dotnet esteja instalado, roda dotnet run em segundo plano
    if (Get-Command dotnet -ErrorAction SilentlyContinue) {
        Start-Process dotnet -ArgumentList "run" -WorkingDirectory $apiPath -WindowStyle Hidden
        Write-Host " -> Servidor .NET ativo em http://localhost:5000" -ForegroundColor Green
    }
}

# 2. Abre a interface no modo Desktop Window (ou navegador em modo app Kiosk)
$previewHtml = Join-Path $rootPath "test-pdv-preview.html"
Write-Host "[2/2] Abrindo interface gráfica do PDV..." -ForegroundColor Yellow

# Tenta abrir no Chrome ou Edge em modo janela de aplicativo nativa (--app=)
$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"

if (Test-Path $msedgePath) {
    Start-Process $msedgePath -ArgumentList "--app=file:///$previewHtml", "--start-maximized"
} elseif (Test-Path $chromePath) {
    Start-Process $chromePath -ArgumentList "--app=file:///$previewHtml", "--start-maximized"
} else {
    Start-Process $previewHtml
}

Write-Host "`nPDV iniciado com sucesso!" -ForegroundColor Green
