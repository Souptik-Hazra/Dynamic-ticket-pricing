@echo off
title Dynamic Ticket Pricing - Restart All Services
color 0B

echo ========================================
echo   Dynamic Ticket Pricing System
echo   Restarting All Services
echo ========================================
echo.

echo [1/5] Stopping existing processes...
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM python.exe >nul 2>&1
timeout /t 2 /nobreak >nul
echo Done!
echo.

echo [2/5] Starting MongoDB (if not running)...
REM Check if mongod is running
for /f "tokens=2 delims==;" %%I in ('wmic process where "name='mongod.exe'" get ProcessId /value 2^>nul') do set MONGO_PID=%%I
if not defined MONGO_PID (
    start "MongoDB" cmd /k "mongod"
    echo MongoDB started in new window.
    timeout /t 5 /nobreak >nul
) else (
    echo MongoDB is already running.
)
echo Done!
echo.

echo [3/5] Starting ML API...
start "ML API" cmd /k "cd ml-model && python app.py"
timeout /t 3 /nobreak >nul
echo Done!
echo.

echo [3.5/5] Running Fraud Analytics Update...
start "Fraud Analytics" cmd /k "cd ml-model && python fraud_detector.py"
timeout /t 3 /nobreak >nul
echo Done!
echo.

echo [4/5] Starting Backend...
start "Backend" cmd /k "cd backend && npm start"
timeout /t 3 /nobreak >nul
echo Done!
echo.

echo [5/5] Starting Frontend...
start "Frontend" cmd /k "npm run dev"
timeout /t 2 /nobreak >nul
echo Done!
echo.

echo ========================================
echo   All Services Started Successfully!
echo ========================================
echo.
echo Services running:
echo   * MongoDB:   http://localhost:27017
echo   * ML API:    http://localhost:5000
echo   * Backend:   http://localhost:3001
echo   * Frontend:  http://localhost:5173
echo.
echo Press any key to exit...
pause >nul
