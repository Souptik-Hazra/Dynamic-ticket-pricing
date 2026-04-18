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

echo [4/6] Starting Microservices...
start "API Gateway" cmd /k "cd microservices/api-gateway && npm start"
start "Auth Service" cmd /k "cd microservices/authentication-service && npm start"
start "User Service" cmd /k "cd microservices/user-service && npm start"
start "Admin Service" cmd /k "cd microservices/admin-service && npm start"
start "Payment Service" cmd /k "cd microservices/payment-service && npm start"
start "Cache Service" cmd /k "cd microservices/cache-service && npm start"
start "Concurrency Service" cmd /k "cd microservices/concurrency-service && npm start"
start "Email Service" cmd /k "cd microservices/email-service && npm start"
start "Message Queue Service" cmd /k "cd microservices/message-queue-service && npm start"
start "Notification Service" cmd /k "cd microservices/notification-service && npm start"
start "WebSocket Service" cmd /k "cd microservices/websocket-service && npm start"
start "Analytics Service" cmd /k "cd microservices/analytics-service && npm start"
start "Subscription Service" cmd /k "cd microservices/subscription-service && npm start"
timeout /t 5 /nobreak >nul
echo Done!
echo.

echo [5/6] Starting Frontend...
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
echo   * API Gateway: http://localhost:3001
echo   * Frontend:  http://localhost:5173
echo   * All microservices on their respective ports
echo.
echo Press any key to exit...
pause >nul
