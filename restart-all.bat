@echo off
title Dynamic Ticket Pricing - Restart All Services
color 0B

echo ========================================
echo   Dynamic Ticket Pricing System
echo   Restarting All Services
echo ========================================
echo.

echo [1/4] Stopping existing processes...
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM python.exe >nul 2>&1
timeout /t 2 /nobreak >nul
echo Done!
echo.

echo [2/4] Starting ML API...
start "ML API" cmd /k "cd ml-model && python app.py"
timeout /t 3 /nobreak >nul
echo Done!
echo.

echo [3/4] Starting Backend...
start "Backend" cmd /k "cd backend && npm start"
timeout /t 3 /nobreak >nul
echo Done!
echo.

echo [4/4] Starting Frontend...
start "Frontend" cmd /k "npm run dev"
timeout /t 2 /nobreak >nul
echo Done!
echo.

echo ========================================
echo   All Services Started Successfully!
echo ========================================
echo.
echo Services running:
echo   * ML API:    http://localhost:5000
echo   * Backend:   http://localhost:3001
echo   * Frontend:  http://localhost:5173
echo.
echo Press any key to exit...
pause >nul
