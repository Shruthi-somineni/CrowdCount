@echo off
REM CrowdCount - Server Status Check

cls
echo ================================
echo CrowdCount Server Status Check
echo ================================
echo.

echo Checking Node.js Auth Server (Port 3000)...
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://127.0.0.1:3000/api/health' -ErrorAction Stop -TimeoutSec 3; Write-Host '✅ Node.js Server: RUNNING' -ForegroundColor Green } catch { Write-Host '❌ Node.js Server: NOT RUNNING' -ForegroundColor Red }"

echo.
echo Checking Flask YOLO Server (Port 5000)...
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://127.0.0.1:5000/api/health' -ErrorAction Stop -TimeoutSec 3; Write-Host '✅ Flask Server: RUNNING' -ForegroundColor Green } catch { Write-Host '❌ Flask Server: NOT RUNNING' -ForegroundColor Red }"

echo.
echo ================================
echo Status Check Complete
echo ================================
echo.
echo If either server is NOT RUNNING:
echo 1. Open START_SERVERS.bat
echo 2. This will start both servers
echo.
pause
