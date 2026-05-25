@echo off
echo Starting Ads Dashboard...
echo.
echo Building frontend...
cd /d "%~dp0frontend"
call npm run build >nul 2>&1
echo Frontend built.
echo.
echo Starting backend (serves frontend + API)...
cd /d "%~dp0backend"
start "Ads Backend" cmd /k "node server.js"
timeout /t 2 /nobreak >nul
echo.
echo Dashboard: http://localhost:3001
echo Login: admin / admin123
echo.
pause
