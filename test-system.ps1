Write-Host "`n========== COMPREHENSIVE SYSTEM TEST ==========" -ForegroundColor Cyan
Write-Host ""

# Test 1: ML API Health
Write-Host "Testing ML API Health..." -NoNewline
try {
    $response = Invoke-RestMethod -Uri "http://localhost:5000/health" -TimeoutSec 5
    Write-Host " ✅ PASS" -ForegroundColor Green
} catch {
    Write-Host " ❌ FAIL" -ForegroundColor Red
}

# Test 2: ML Prediction
Write-Host "Testing ML Prediction..." -NoNewline
try {
    $data = @{
        demand = 75
        historical_avg = 100
        days_until = 7
        weather = 1
        is_weekend = 0
        competition = 0
    } | ConvertTo-Json
    $response = Invoke-RestMethod -Uri "http://localhost:5000/predict" -Method POST -Body $data -ContentType "application/json" -TimeoutSec 5
    Write-Host " ✅ PASS (Price: `$$($response.predicted_price))" -ForegroundColor Green
} catch {
    Write-Host " ❌ FAIL" -ForegroundColor Red
}

# Test 3: Backend Health
Write-Host "Testing Backend Health..." -NoNewline
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/health" -TimeoutSec 5
    Write-Host " ✅ PASS (MongoDB: $($response.services.mongodb))" -ForegroundColor Green
} catch {
    Write-Host " ❌ FAIL" -ForegroundColor Red
}

# Test 4: Backend Events
Write-Host "Testing Backend Events..." -NoNewline
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/events" -TimeoutSec 5
    Write-Host " ✅ PASS ($($response.Count) events)" -ForegroundColor Green
} catch {
    Write-Host " ❌ FAIL" -ForegroundColor Red
}

# Test 5: Frontend
Write-Host "Testing Frontend..." -NoNewline
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5173" -UseBasicParsing -TimeoutSec 5
    Write-Host " ✅ PASS (Status: $($response.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host " ❌ FAIL" -ForegroundColor Red
}

# Test 6: MongoDB
Write-Host "Testing MongoDB Service..." -NoNewline
try {
    $service = Get-Service -Name MongoDB
    if ($service.Status -eq "Running") {
        Write-Host " ✅ PASS" -ForegroundColor Green
    } else {
        Write-Host " ❌ FAIL (Not Running)" -ForegroundColor Red
    }
} catch {
    Write-Host " ❌ FAIL (Not Found)" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
