@echo off
title ATYLUS PDV - Sistema de Ponto de Venda Profissional
color 0b
echo ========================================================
echo               INICIANDO ATYLUS PDV DESKTOP
echo ========================================================
echo.

set PDV_DESKTOP_MODE=1
set ASPNETCORE_URLS=http://localhost:5000

:: Verifica se a porta 5000 ja esta aberta
netstat -ano | findstr ":5000" >nul
if %errorlevel% neq 0 (
    echo Iniciando motor do PDV (SQLite + API + Cloud Sync)...
    start "" /b "%~dp0PDV.API.exe"
    timeout /t 2 /nobreak >nul
) else (
    echo Motor do PDV ja ativo na porta 5000.
)

echo Abrindo aplicativo em modo janela nativa...
:: Tenta abrir em modo Janela Nativa Desktop (App Mode sem barra de navegacao)
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app=http://localhost:5000 --window-size=1280,800
    exit /b 0
)

if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --app=http://localhost:5000 --window-size=1280,800
    exit /b 0
)

if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app=http://localhost:5000 --window-size=1280,800
    exit /b 0
)

if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" --app=http://localhost:5000 --window-size=1280,800
    exit /b 0
)

:: Fallback para navegador padrao
start http://localhost:5000
exit /b 0
