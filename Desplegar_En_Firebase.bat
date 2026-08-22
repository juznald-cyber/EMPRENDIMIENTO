@echo off
title Desplegar en Firebase Hosting
cd /d "%~dp0"
echo ========================================================
echo   SINCRONIZANDO Y DESPLEGANDO EN FIREBASE HOSTING
echo   Proyecto: emprendimiento-f8b3a
echo ========================================================
echo.

if not exist public mkdir public
if exist css xcopy /E /Y /I css public\css >nul
if exist js xcopy /E /Y /I js public\js >nul
if exist assets xcopy /E /Y /I assets public\assets >nul
if exist index.html copy /Y index.html public\index.html >nul
if exist manifest.json copy /Y manifest.json public\manifest.json >nul
if exist sw.js copy /Y sw.js public\sw.js >nul

echo [1/2] Verificando sesion de Google / Firebase...
cmd.exe /c "npx -y firebase-tools@latest login"

echo.
echo [2/2] Subiendo archivos a Firebase Hosting...
cmd.exe /c "npx -y firebase-tools@latest deploy --only hosting --project emprendimiento-f8b3a"

echo.
echo ========================================================
echo   PROCESO FINALIZADO CON EXITO!
echo   Tu enlace: https://emprendimiento-f8b3a.web.app
echo ========================================================
pause
