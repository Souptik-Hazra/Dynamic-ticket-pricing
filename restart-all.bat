@echo off
title FanFever - Modular Monolith Restart
color 0B

echo ========================================
echo   FanFever: AI-Powered Platform
echo   Modular Monolith Orchestrator
echo ========================================
echo.

echo [1/4] Cleaning existing environment...
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM python.exe >nul 2>&1
echo ✅ Processes cleared.
echo.

echo [2/4] Verifying Databases...
echo Checking MongoDB...
for /f "tokens=2 delims==;" %%I in ('wmic process where "name='mongod.exe'" get ProcessId /value 2^>nul') do set MONGO_PID=%%I
if not defined MONGO_PID (
    echo ⚠️ MongoDB not found. Attempting to start...
    start "MongoDB" /min cmd /k "mongod"
    timeout /t 5 /nobreak >nul
) else (
    echo ✅ MongoDB is running.
)
echo.

echo [3/4] Launching Modular Monolith Core...
echo (Includes API, WebSocket, and AI Engine)
cd modular-monolith
start "FanFever Backend" cmd /k "npm run dev"
cd ..
timeout /t 5 /nobreak >nul
echo ✅ Core initialized.
echo.

echo [4/4] Launching Frontend Interface...
start "FanFever Frontend" cmd /k "npm run dev"
timeout /t 2 /nobreak >nul
echo ✅ Frontend initialized.
echo.

echo ========================================
echo   🚀 All Systems Online!
echo ========================================
echo.
echo Dashboard: http://localhost:5173
echo API Core:  http://localhost:4000
echo AI Engine: http://localhost:5000
echo.
echo Press any key to close this manager...
pause >nul
