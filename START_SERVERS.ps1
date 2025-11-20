# CrowdCount - Start Both Servers
# This script starts both Node.js and Flask servers in separate windows

Write-Host "================================" -ForegroundColor Cyan
Write-Host "CrowdCount Server Startup" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Get the script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Start Node.js Auth Server (Port 3000)
Write-Host "🟦 Starting Node.js Auth Server (Port 3000)..." -ForegroundColor Blue
Start-Process powershell -ArgumentList "-NoExit -Command `"cd '$scriptDir\server'; npm start`""

# Wait a bit for Node server to start
Start-Sleep -Seconds 3

# Start Flask YOLO Server (Port 5000)
Write-Host "🟨 Starting Flask YOLO Server (Port 5000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit -Command `"cd '$scriptDir'; python app.py`""

Write-Host ""
Write-Host "================================" -ForegroundColor Green
Write-Host "✅ Both servers starting..." -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""
Write-Host "📍 Auth Server: http://127.0.0.1:3000" -ForegroundColor Cyan
Write-Host "📍 YOLO Server: http://127.0.0.1:5000" -ForegroundColor Yellow
Write-Host ""
Write-Host "Open your browser and navigate to:" -ForegroundColor Green
Write-Host "http://127.0.0.1:3000" -ForegroundColor Green
Write-Host ""
Write-Host "Press Ctrl+C in either window to stop that server" -ForegroundColor Magenta
