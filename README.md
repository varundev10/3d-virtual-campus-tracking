# 3D Virtual Campus Real-Time Tracking System

A photorealistic, geo-registered 3D virtual campus web platform with real-time GPS tracking of students and faculty bounded by a geofence.

## Quick Start (1-Click Run)

### Option 1: Double-click or run `start.bat`
In File Explorer, simply double-click `start.bat` (or run in Command Prompt):
```cmd
start.bat
```

### Option 2: Run via PowerShell
```powershell
.\start.ps1
```

Both Backend and Frontend will automatically start in separate windows and open `http://localhost:5173` in your default browser!

---

## Default Login Credentials

- **Admin Email:** `admin@campus.local`
- **Admin Password:** `AdminPass123`
*(You can also register a new student/user account directly from the UI)*

---

## Manual Running

### 1. Backend (`tracking-backend`)
```powershell
cd tracking-backend
.\mvnw spring-boot:run
```
- By default, it uses a zero-setup persistent embedded database (`./data/campus_db`). No MySQL installation or configuration is needed!
- Backend runs on `http://localhost:8080`.
- If you prefer external MySQL, run:
  ```powershell
  .\mvnw spring-boot:run -Dspring-boot.run.profiles=mysql
  ```

### 2. Frontend (`tracking-frontend`)
```powershell
cd tracking-frontend
npm run dev
```
- Frontend runs on `http://localhost:5173`.
