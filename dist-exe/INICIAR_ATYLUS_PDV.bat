@echo off
title ATYLUS PDV - Sistema de Ponto de Venda
color 0b
echo ========================================================
echo               INICIANDO ATYLUS PDV
echo ========================================================
echo.
set PDV_DESKTOP_MODE=1
set ASPNETCORE_URLS=http://localhost:5000

echo Abrindo navegador no sistema...
start http://localhost:5000

echo Iniciando servidor e banco de dados SQLite...
PDV.API.exe
pause
