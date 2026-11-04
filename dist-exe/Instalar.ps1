<#
.SYNOPSIS
    Script de Instalação Automatizada 1-Click do ATYLUS PDV Desktop
#>

$ErrorActionPreference = "Stop"
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "       INSTALADOR AUTOMATIZADO - ATYLUS PDV DESKTOP     " -ForegroundColor Yellow
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

$origem = $PSScriptRoot
if (-not (Test-Path "$origem\PDV.API.exe")) {
    $origem = "$PSScriptRoot\dist-exe"
}

if (-not (Test-Path "$origem\PDV.API.exe")) {
    Write-Host "[ERRO] Arquivos de instalacao nao encontrados em $origem" -ForegroundColor Red
    pause
    exit 1
}

$destino = Join-Path $env:LOCALAPPDATA "ATYLUS-PDV"
Write-Host "-> Instalando ATYLUS PDV em: $destino" -ForegroundColor Green

if (-not (Test-Path $destino)) {
    New-Item -ItemType Directory -Path $destino -Force | Out-Null
}

Write-Host "-> Copiando arquivos do sistema (Motor .NET 8, SQLite, Frontend)..." -ForegroundColor Gray
Copy-Item -Path "$origem\*" -Destination $destino -Recurse -Force -Exclude "Instalador_ATYLUS_PDV.bat", "Instalar.ps1"

# Cria Atalho na Area de Trabalho e Menu Iniciar
$wsh = New-Object -ComObject WScript.Shell

# Caminho do executavel de inicializacao
$launcherBat = Join-Path $destino "INICIAR_ATYLUS_PDV.bat"
$apiExe = Join-Path $destino "PDV.API.exe"

# Atalho no Desktop
$desktopPath = [Environment]::GetFolderPath("Desktop")
$shortcutDesktop = $wsh.CreateShortcut("$desktopPath\ATYLUS PDV.lnk")
$shortcutDesktop.TargetPath = $launcherBat
$shortcutDesktop.WorkingDirectory = $destino
$shortcutDesktop.IconLocation = "$apiExe,0"
$shortcutDesktop.Description = "ATYLUS PDV - Sistema de Ponto de Venda Profissional"
$shortcutDesktop.Save()
Write-Host "-> Atalho criado na Area de Trabalho: $desktopPath\ATYLUS PDV.lnk" -ForegroundColor Green

# Atalho no Menu Iniciar
$startMenuPrograms = [Environment]::GetFolderPath("Programs")
$shortcutStart = $wsh.CreateShortcut("$startMenuPrograms\ATYLUS PDV.lnk")
$shortcutStart.TargetPath = $launcherBat
$shortcutStart.WorkingDirectory = $destino
$shortcutStart.IconLocation = "$apiExe,0"
$shortcutStart.Description = "ATYLUS PDV - Sistema de Ponto de Venda Profissional"
$shortcutStart.Save()
Write-Host "-> Atalho criado no Menu Iniciar." -ForegroundColor Green

Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "           INSTALACAO CONCLUIDA COM SUCESSO!            " -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Iniciando o ATYLUS PDV agora..." -ForegroundColor Yellow

Start-Process -FilePath $launcherBat -WorkingDirectory $destino
Start-Sleep -Seconds 2
