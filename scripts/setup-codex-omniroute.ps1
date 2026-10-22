<#
.SYNOPSIS
    Configura o ambiente Windows para integração entre OpenAI Codex CLI e OmniRoute.
.DESCRIPTION
    Aplica as variáveis de ambiente necessárias para sessões resilientes (long-running tasks),
    cria a pasta ~/.codex e copia o arquivo de configuração config.toml com os 7 perfis.
#>

[CmdletBinding()]
param(
    [string]$OmniRouteUrl = "http://localhost:2024",
    [string]$OmniRouteKey = "sk-omniroute-local"
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "    Configurando Codex CLI para utilizar o OmniRoute     " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Configurar variáveis de ambiente do usuário
Write-Host "`n[1/3] Definindo variáveis de ambiente..." -ForegroundColor Yellow
[Environment]::SetEnvironmentVariable("OMNIROUTE_URL", $OmniRouteUrl, "User")
[Environment]::SetEnvironmentVariable("OMNIROUTE_KEY", $OmniRouteKey, "User")
[Environment]::SetEnvironmentVariable("STREAM_IDLE_TIMEOUT_MS", "0", "User")
[Environment]::SetEnvironmentVariable("FETCH_BODY_TIMEOUT_MS", "0", "User")

$env:OMNIROUTE_URL = $OmniRouteUrl
$env:OMNIROUTE_KEY = $OmniRouteKey
$env:STREAM_IDLE_TIMEOUT_MS = "0"
$env:FETCH_BODY_TIMEOUT_MS = "0"

Write-Host " -> OMNIROUTE_URL: $OmniRouteUrl" -ForegroundColor Green
Write-Host " -> STREAM_IDLE_TIMEOUT_MS: 0 (Desativado para tarefas longas)" -ForegroundColor Green
Write-Host " -> FETCH_BODY_TIMEOUT_MS: 0" -ForegroundColor Green

# 2. Configurar arquivo ~/.codex/config.toml
Write-Host "`n[2/3] Atualizando configuração em ~/.codex/config.toml..." -ForegroundColor Yellow
$codexDir = Join-Path $env:USERPROFILE ".codex"
if (-not (Test-Path $codexDir)) {
    New-Item -ItemType Directory -Path $codexDir -Force | Out-Null
}

$templatePath = Join-Path $PSScriptRoot "codex-config.toml.template"
$targetPath = Join-Path $codexDir "config.toml"

if (Test-Path $templatePath) {
    Copy-Item -Path $templatePath -Destination $targetPath -Force
    Write-Host " -> Arquivo de configuração gravado com sucesso em: $targetPath" -ForegroundColor Green
} else {
    Write-Host " -> Aviso: Template não encontrado em $templatePath" -ForegroundColor Red
}

# 3. Teste de conectividade com o OmniRoute
Write-Host "`n[3/3] Verificando se o OmniRoute está ativo em $OmniRouteUrl..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$OmniRouteUrl/v1/models" -Method Get -TimeoutSec 3 -ErrorAction Stop
    Write-Host " -> OmniRoute detectado online! Modelos disponíveis encontrados." -ForegroundColor Green
} catch {
    Write-Host " -> O OmniRoute ainda não parece estar rodando no momento." -ForegroundColor DarkYellow
    Write-Host "    Para iniciá-lo, execute no terminal: npx omniroute (ou omniroute)" -ForegroundColor DarkYellow
}

Write-Host "`nConfiguração concluída com sucesso!" -ForegroundColor Cyan
Write-Host "Exemplo de uso: codex --profile smart 'Refatore esta função'" -ForegroundColor White
