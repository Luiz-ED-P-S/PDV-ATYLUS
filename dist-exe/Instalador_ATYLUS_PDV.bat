@echo off
title Instalador ATYLUS PDV
color 0a
echo ========================================================
echo         INSTALADOR AUTOMATICO - ATYLUS PDV DESKTOP
echo ========================================================
echo.
echo Iniciando instalacao 1-click do sistema...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Instalar.ps1"
if %errorlevel% neq 0 (
    echo.
    echo Ocorreu um erro durante a instalacao.
    pause
)
exit /b 0
