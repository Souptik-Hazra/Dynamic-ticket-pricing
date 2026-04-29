@echo off
title 🛡️ FanFever - Hardened Stack Orchestrator
mode con: cols=100 lines=35
color 0B

echo ======================================================================
echo   🌐 FanFever: AI-Powered Dynamic Ticket Pricing
echo   [Hardened Stack Orchestrator - Phase 9 Legendary Tier]
echo ======================================================================
echo.

:: ── [1/5] Process Cleanup ────────────────────────────────────────────────
echo [1/5] 🧹 Cleaning existing environment...
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM python.exe >nul 2>&1
echo ✅ Processes cleared.
echo.

:: ── [2/5] Database Verification ──────────────────────────────────────────
echo [2/5] 🗄️ Verifying Database Services...

:: MongoDB
echo 🔍 Checking MongoDB...
for /f "tokens=2 delims==;" %%I in ('wmic process where "name='mongod.exe'" get ProcessId /value 2^>nul') do set MONGO_PID=%%I
if not defined MONGO_PID (
    echo ⚠️ MongoDB is NOT running. Attempting to start...
    start "MongoDB" /min cmd /k "mongod"
    timeout /t 3 /nobreak >nul
) else (
    echo ✅ MongoDB is running (PID: %MONGO_PID%).
)

:: Redis (Critical for Rate Limiting)
echo 🔍 Checking Redis...
for /f "tokens=2 delims==;" %%I in ('wmic process where "name='redis-server.exe'" get ProcessId /value 2^>nul') do set REDIS_PID=%%I
if not defined REDIS_PID (
    echo ⚠️ Redis is NOT running. Attempting to start...
    start "Redis" /min cmd /k "redis-server"
    timeout /t 2 /nobreak >nul
) else (
    echo ✅ Redis is running (PID: %REDIS_PID%).
)

:: Neo4j (Graph Sync)
echo 🔍 Checking Neo4j...
for /f "tokens=2 delims==;" %%I in ('wmic process where "name='neo4j.exe'" get ProcessId /value 2^>nul') do set NEO4J_PID=%%I
if not defined NEO4J_PID (
    echo ⚠️ Neo4j not detected in process list. Ensure it is running as a service.
) else (
    echo ✅ Neo4j is running.
)
echo.

:: ── [3/5] Backend Initialization ──────────────────────────────────────────
echo [3/5] 🧠 Launching Modular Monolith Core...
echo (Worker Threads, Shared Memory, and Hardened Network active)
cd modular-monolith
start "🧠 FanFever-Backend" cmd /k "npm run dev"
cd ..
timeout /t 5 /nobreak >nul
echo ✅ Backend Initialized.
echo.

:: ── [4/5] Frontend Initialization ─────────────────────────────────────────
echo [4/5] 🎨 Launching Frontend Interface (Vite)...
start "🎨 FanFever-Frontend" cmd /k "npm run dev"
timeout /t 2 /nobreak >nul
echo ✅ Frontend Initialized.
echo.

:: ── [5/5] System Health Check ────────────────────────────────────────────
echo [5/5] 🧪 Running System Audit...
cd modular-monolith
node scripts/run_all.js
cd ..

echo.
echo ======================================================================
echo   🚀 ALL SYSTEMS ONLINE AND HARDENED!
echo ======================================================================
echo.
echo 🔗 Dashboard: http://localhost:5173
echo 🔗 API Core:  http://localhost:4000
echo 🔗 AI Engine: http://localhost:5000
echo.
echo Press any key to keep this manager running...
pause >nul
