@echo off
title Desplegar en Firebase Hosting
echo ========================================================
echo  SINCRONIZANDO Y DESPLEGANDO EN FIREBASE HOSTING
echo  Proyecto: emprendimiento-f8b3a
echo ========================================================
echo.
if not exist public mkdir public
xcopy /E /Y /I css public\css >nul
xcopy /E /Y /I js public\js >nul
xcopy /E /Y /I assets public\assets >nul
copy /Y index.html public\index.html >nul
copy /Y manifest.json public\manifest.json >nul
copy /Y sw.js public\sw.js >nul

echo Archivos sincronizados en carpeta public.
echo Iniciando despliegue a Firebase Hosting...
echo.
call npx -y firebase-tools@latest deploy --only hosting
echo.
echo ========================================================
echo  Despliegue finalizado!
echo  Tu enlace: https://emprendimiento-f8b3a.web.app
echo ========================================================
pause
