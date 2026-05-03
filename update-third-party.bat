@echo off
echo ========================================
echo Actualizando Wokwi Libraries
echo ========================================
echo.

cd third-party

echo [1/3] Actualizando wokwi-elements...
cd wokwi-elements
git pull origin main
call npm install --legacy-peer-deps
call npm run build
cd ..

echo.
echo [2/3] Actualizando avr8js...
cd avr8js
git pull origin main
call npm install --legacy-peer-deps
call npm run build
cd ..

echo.
echo [3/3] Actualizando rp2040js...
cd rp2040js
git pull origin main
call npm install --legacy-peer-deps
call npm run build
cd ..

cd ..

echo.
echo ========================================
echo Actualizacion completada!
echo ========================================
echo.
echo Los repositorios de Wokwi han sido actualizados.
echo Puedes reiniciar el servidor de desarrollo si estaba corriendo.
echo.
pause
