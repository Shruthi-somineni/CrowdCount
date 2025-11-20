@echo off
REM CrowdCount - Start Both Servers
REM This batch file starts both Node.js and Flask servers

cls
echo ================================
echo CrowdCount Server Startup
echo ================================
echo.

REM Get the directory where this batch file is located
set "SCRIPT_DIR=%~dp0"

echo 🟦 Starting Node.js Auth Server (Port 3000)...
start "CrowdCount Auth Server" cmd /k "cd /d %SCRIPT_DIR%\server && npm start"

timeout /t 3 /nobreak

echo 🟨 Starting Flask YOLO Server (Port 5000)...
start "CrowdCount YOLO Server" cmd /k "cd /d %SCRIPT_DIR% && python app.py"

echo.
echo ================================
echo ✅ Both servers starting...
echo ================================
echo.
echo 📍 Auth Server: http://127.0.0.1:3000
echo 📍 YOLO Server: http://127.0.0.1:5000
echo.
echo Open your browser and navigate to:
echo http://127.0.0.1:3000
echo.
echo Press Ctrl+C in either window to stop that server
echo.
