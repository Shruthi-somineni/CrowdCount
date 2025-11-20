@echo off
REM Start Node.js server with detailed error output

cd /d e:\login\server

echo ================================
echo Starting Node.js Auth Server
echo ================================
echo.
echo Port: 3000
echo Working Directory: %cd%
echo.

echo Checking dependencies...
npm list express cors body-parser jsonwebtoken bcryptjs sqlite3 --depth=0

echo.
echo Starting server...
echo.

npm start

pause
