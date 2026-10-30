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
- It stores data in **PostgreSQL** (`DB_URL`, `DB_USERNAME`, `DB_PASSWORD`; defaults to `localhost:5432/campus_tracking`).
- To try it without a database, run `.\mvnw spring-boot:test-run`: an in-memory H2 database, with the admin
  `admin@test.local` / `AdminPass123`. Data is lost on shutdown.
- Backend runs on `http://localhost:8080`.

> **Before deploying anywhere shared, set `APP_JWT_SECRET` and `APP_ADMIN_PASSWORD`** (and `APP_ADMIN_EMAIL`). The
> defaults above are public in this repository, so anyone could forge login tokens or sign in as admin. The backend
> logs a warning at startup while either default is in use.

### 2. Frontend (`tracking-frontend`)
```powershell
cd tracking-frontend
npm run dev
```
- Frontend runs on `http://localhost:5173`.

## Attendance, alerts and the assistant

**Setup (admin → Academics):** create departments, add the classrooms (position, radius, floor) and the weekly
timetable, then give students and faculty a department (in Users, or students pick one when registering). A faculty
member can be made head of their department.

**Automatic attendance.** While a class is running (and for 10 minutes before), a student whose shared position is inside
the classroom is marked **present** once, at the time they arrived. Shortly after the class ends, anyone unmarked is
finalized: **bunked** (with an alert) if they were on campus during the class but never entered the room, otherwise
**absent**. Faculty can override any mark with a note; manual marks always win. A faculty member who never reaches their
own classroom raises an **off-schedule** alert. Students never mark themselves, so attendance cannot be faked from a sofa.

**Anomaly detection.** A jump of 100 m or more faster than 30 m/s between two positions raises an *unusual movement*
alert (spoofed GPS or a shared device), at most once per 15 minutes per user. Admins and faculty acknowledge alerts;
the admin overview has a "needs attention" strip, live occupancy (counts only, never names) and hourly footfall.

**Reports.** Attendance by department, students below the required percentage (default 75%), and a CSV export that is
safe to open in a spreadsheet (formulas in names or notes are neutralised).

**Campus assistant.** The chat button answers from the signed-in user's own role-scoped data: timetable, attendance and
how many classes can still be missed, alerts, who is missing from a class (faculty), occupancy (admin) and where places
are. It runs entirely on the server with no API key, and no student data leaves the system.

**Time.** Timetables are in campus time. The server runs on `APP_TIMEZONE` (default `Asia/Kolkata`) so stored,
zone-less timestamps agree with the timetable. Other knobs: `APP_ATTENDANCE_EARLY_MINUTES`, `APP_ATTENDANCE_GRACE_MINUTES`,
`APP_ATTENDANCE_REQUIRED_PERCENT`, `APP_ANOMALY_MAX_SPEED_MPS`, `APP_ANOMALY_MIN_JUMP_METERS`.

## Campus data

The places on the campus map and in the explorer come from the database, which is seeded on first start from
`tracking-backend/.../config/DataInitializer.java`. `tracking-frontend/src/lib/campus-buildings.js` holds the same list
for the sign-in page's 3D campus; `npm run lint` checks that the two agree.

The list is **provisional**: it has the five named UCER places that OpenStreetMap knows (Main Building, Block B,
Pharmacy, Central Library, Hostel), positioned at the centre of their OpenStreetMap outlines. The A-D blocks and the
other facilities still have to be added. Position data is © OpenStreetMap contributors, available under the
[ODbL](https://www.openstreetmap.org/copyright).

**An existing database keeps its old places.** The seed only runs when the places table is empty. To pick up the new
list, delete the old places in Admin > Campus Locations (or clear the `campus_locations` table) and restart the backend.
