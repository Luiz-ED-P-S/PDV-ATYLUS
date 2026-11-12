# Publica o backend ASP.NET Core self-contained (win-x64) em src/desktop/resources/backend.
# O cliente final NAO precisa de .NET instalado.
$ErrorActionPreference = 'Stop'
$raiz = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$saida = Join-Path $raiz 'src\desktop\resources\backend'
if (Test-Path $saida) { Remove-Item $saida -Recurse -Force }
dotnet publish (Join-Path $raiz 'src\backend\PDV.API\PDV.API.csproj') -c Release -r win-x64 --self-contained true `
  -p:DebugType=none -p:DebugSymbols=false -o $saida
if ($LASTEXITCODE -ne 0) { throw 'Falha ao publicar o backend.' }
# Nunca empacotar bancos, chaves ou configuracoes de desenvolvimento
Get-ChildItem $saida -Recurse -Include *.db,*.db-shm,*.db-wal,pdv-jwt*,appsettings.Development.json -ErrorAction SilentlyContinue | Remove-Item -Force
if (-not (Test-Path (Join-Path $saida 'wwwroot\index.html'))) { throw 'wwwroot/index.html ausente: rode "npm run build:frontend" antes.' }
Write-Host "Backend publicado em $saida"
