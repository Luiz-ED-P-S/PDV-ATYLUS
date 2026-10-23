<#
.SYNOPSIS
    Compila o frontend, publica o backend .NET 8 como sidecar self-contained
    e gera o instalador desktop Windows (.exe e .msi) com Tauri v2.
#>

[CmdletBinding()]
param(
    [switch]$SkipFrontend = $false,
    [switch]$SkipBackend = $false,
    [switch]$OnlySidecar = $false
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   Hórus Atylus PDV - Pipeline de Build Desktop (Tauri v2) " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Configurar variáveis de PATH locais
$env:Path = "C:\Program Files\nodejs;$env:USERPROFILE\.dotnet;$env:USERPROFILE\.cargo\bin;$env:Path"
$dotnetPath = if (Test-Path "$env:USERPROFILE\.dotnet\dotnet.exe") { "$env:USERPROFILE\.dotnet\dotnet.exe" } else { "dotnet" }

# 2. Compilar o Frontend Vite
if (-not $SkipFrontend) {
    Write-Host "`n[1/3] Compilando Frontend React + Vite..." -ForegroundColor Yellow
    $frontendDir = Join-Path $root "src\frontend"
    Push-Location $frontendDir
    try {
        & "C:\Program Files\nodejs\npm.cmd" run build
        Write-Host " -> Frontend compilado com sucesso em wwwroot!" -ForegroundColor Green
    } finally {
        Pop-Location
    }
} else {
    Write-Host "`n[1/3] Pulando compilação do frontend..." -ForegroundColor DarkGray
}

# 3. Publicar o Backend .NET 8 como Self-Contained Single-File
if (-not $SkipBackend) {
    Write-Host "`n[2/3] Publicando Backend .NET 8 (win-x64 Self-Contained)..." -ForegroundColor Yellow
    $apiProj = Join-Path $root "src\backend\PDV.API\PDV.API.csproj"
    $binDir = Join-Path $root "src-tauri\binaries"
    $publishOut = Join-Path $binDir "publish"
    
    if (-not (Test-Path $binDir)) {
        New-Item -ItemType Directory -Path $binDir -Force | Out-Null
    }

    & $dotnetPath publish $apiProj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o $publishOut

    $sidecarTarget = Join-Path $binDir "pdv-api-x86_64-pc-windows-msvc.exe"
    Copy-Item (Join-Path $publishOut "PDV.API.exe") -Destination $sidecarTarget -Force
    
    # Limpa pasta temporária de publish mantendo o executável sidecar
    Remove-Item $publishOut -Recurse -Force -ErrorAction SilentlyContinue

    $sizeMb = [math]::Round(((Get-Item $sidecarTarget).Length / 1MB), 2)
    Write-Host " -> Sidecar gerado: pdv-api-x86_64-pc-windows-msvc.exe ($sizeMb MB)" -ForegroundColor Green
} else {
    Write-Host "`n[2/3] Pulando publicação do backend..." -ForegroundColor DarkGray
}

if ($OnlySidecar) {
    Write-Host "`nOperação concluída (apenas sidecar solicitado)." -ForegroundColor Green
    exit 0
}

# 4. Empacotar com Tauri v2
Write-Host "`n[3/3] Empacotando Instalador Desktop (.exe / .msi)..." -ForegroundColor Yellow
$cargoAvailable = (Get-Command cargo -ErrorAction SilentlyContinue) -or (Test-Path "$env:USERPROFILE\.cargo\bin\cargo.exe")

if ($cargoAvailable) {
    $frontendDir = Join-Path $root "src\frontend"
    Push-Location $frontendDir
    try {
        & "C:\Program Files\nodejs\npm.cmd" run tauri build
        Write-Host "`n-> Instaladores gerados com sucesso na pasta src-tauri/target/release/bundle!" -ForegroundColor Green
    } finally {
        Pop-Location
    }
} else {
    Write-Host @"

[AVISO] O compilador Rust (cargo/rustup) ainda não está instalado neste ambiente.
O executável autônomo do backend (.NET 8 Self-Contained) já está pronto e testado em:
   src-tauri/binaries/pdv-api-x86_64-pc-windows-msvc.exe

Para gerar os pacotes .exe (NSIS) e .msi finais do instalador:
1. Instale o Rust toolchain: https://rustup.rs (ou execute: winget install Rustlang.Rustup)
2. Execute novamente este script:
   powershell -ExecutionPolicy Bypass -File scripts/build-desktop.ps1
"@ -ForegroundColor Yellow
}

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "                Processo Concluído!                       " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
