Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "          3D VIRTUAL CAMPUS REAL-TIME TRACKING SYSTEM" -ForegroundColor Yellow
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

$root = $PSScriptRoot

Write-Host "[1/3] Checking environment..." -ForegroundColor White
if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Java 17+ is required but not found in PATH." -ForegroundColor Red
    pause
    exit 1
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Node.js is required but not found in PATH." -ForegroundColor Red
    pause
    exit 1
}

$backendRunning = (Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue)
if ($backendRunning) {
    Write-Host "[INFO] Backend is already running on port 8080." -ForegroundColor Yellow
} else {
    Write-Host "[2/3] Starting Backend (Port 8080)..." -ForegroundColor Green
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\tracking-backend'; Write-Host 'Starting Spring Boot Backend...' -ForegroundColor Cyan; .\mvnw spring-boot:run"
}

$frontendRunning = (Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue)
if ($frontendRunning) {
    Write-Host "[INFO] Frontend is already running on port 5173." -ForegroundColor Yellow
} else {
    Write-Host "[3/3] Starting Frontend (Port 5173)..." -ForegroundColor Green
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\tracking-frontend'; Write-Host 'Starting React Frontend...' -ForegroundColor Cyan; npm run dev"
}

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host " All services have been launched in separate windows!" -ForegroundColor Green
Write-Host " - Frontend URL : http://localhost:5173" -ForegroundColor Yellow
Write-Host " - Backend API  : http://localhost:8080" -ForegroundColor Yellow
Write-Host ""
Write-Host " Default Admin Credentials:" -ForegroundColor White
Write-Host " - Email    : admin@campus.local" -ForegroundColor Cyan
Write-Host " - Password : AdminPass123" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

Start-Sleep -Seconds 5
Start-Process "http://localhost:5173"
