@echo off
title 3D Virtual Campus Real-Time Tracking System
color 0b
echo ======================================================================
echo           3D VIRTUAL CAMPUS REAL-TIME TRACKING SYSTEM
echo ======================================================================
echo.
echo [1/3] Checking environment...
where java >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Java is not found in PATH! Please install Java 17+.
    pause
    exit /b 1
)

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found in PATH! Please install Node.js.
    pause
    exit /b 1
)

netstat -ano | findstr :8080 | findstr LISTENING >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] Backend is already running on port 8080.
) else (
    echo [2/3] Starting Spring Boot Backend (Port 8080)...
    start "Campus Tracking Backend [Port 8080]" cmd /k "cd tracking-backend && .\mvnw spring-boot:run"
)

netstat -ano | findstr :5173 | findstr LISTENING >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] Frontend is already running on port 5173.
) else (
    echo [3/3] Starting React Vite Frontend (Port 5173)...
    start "Campus Tracking Frontend [Port 5173]" cmd /k "cd tracking-frontend && npm run dev"
)

echo.
echo ======================================================================
echo  All services are launching in separate windows!
echo.
echo  - Frontend URL : http://localhost:5173
echo  - Backend API  : http://localhost:8080/api
echo.
echo  Default Admin Login Credentials:
echo  - Email    : admin@campus.local
echo  - Password : AdminPass123
echo ======================================================================
echo.
echo Opening the application in your browser in 5 seconds...
timeout /t 5 /nobreak >nul
start http://localhost:5173
