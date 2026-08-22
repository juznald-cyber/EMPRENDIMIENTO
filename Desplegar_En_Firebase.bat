@echo off
title Desplegar en Firebase Hosting
echo ========================================================
echo  DESPLEGANDO APLICACION EN FIREBASE HOSTING
echo  Proyecto: emprendimiento-f8b3a
echo ========================================================
echo.
call npx -y firebase-tools@latest deploy --only hosting
echo.
echo ========================================================
echo  Proceso finalizado.
echo ========================================================
pause
