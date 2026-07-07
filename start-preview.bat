@echo off
cd /d "%~dp0"
echo ========================================
echo  Gyaru Robot preview
echo ========================================
echo.
echo Opening preview server and browser...
echo PC preview:
echo   http://localhost:8787/
echo.
echo If Windows asks about network access,
echo allow Private networks.
echo.
start "Gyaru Robot Server" powershell -NoExit -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1" -Port 8787
timeout /t 2 > nul
start "" "http://localhost:8787/"
echo Server window opened.
echo Keep the "Gyaru Robot Server" window open while previewing.
timeout /t 4 > nul
