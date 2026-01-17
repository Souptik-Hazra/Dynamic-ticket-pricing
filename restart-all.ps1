# Dynamic Ticket Pricing - Restart All Services

Write-Host "========================================"
Write-Host "  Dynamic Ticket Pricing System"
Write-Host "  Restarting All Services"
Write-Host "========================================"
Write-Host ""

$projectRoot = $PSScriptRoot

# Step 1: Stop processes
Write-Host "[1/4] Stopping existing processes..."
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process -Name "python" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2
Write-Host "      Processes stopped."
Write-Host ""

# Step 2: Start ML API
Write-Host "[2/4] Starting ML API..."
$mlFolder = Join-Path -Path $projectRoot -ChildPath "ml-model"
Start-Process -FilePath "powershell" -ArgumentList "-NoExit -Command Set-Location '$mlFolder'; python app.py"
Start-Sleep -Seconds 3
Write-Host "      ML API: http://localhost:5000"
Write-Host ""

# Step 3: Start Backend
Write-Host "[3/4] Starting Backend..."
$backendFolder = Join-Path -Path $projectRoot -ChildPath "backend"
Start-Process -FilePath "powershell" -ArgumentList "-NoExit -Command Set-Location '$backendFolder'; node server.js"
Start-Sleep -Seconds 3
Write-Host "      Backend: http://localhost:3001"
Write-Host ""

# Step 4: Start Frontend
Write-Host "[4/4] Starting Frontend..."
Start-Process -FilePath "powershell" -ArgumentList "-NoExit -Command Set-Location '$projectRoot'; npm run dev"
Start-Sleep -Seconds 3
Write-Host "      Frontend: http://localhost:5173"
Write-Host ""

Write-Host "========================================"
Write-Host "  All Services Started!"
Write-Host "========================================"
Write-Host ""
Write-Host "Open: http://localhost:5173"
