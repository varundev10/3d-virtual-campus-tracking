# Context: 3D Virtual Campus Real-Time Tracking System

## Project Identity

- **Project Name:** 3D Virtual Campus Real-Time Tracking System
- **Target Institution:** UCER (United College of Engineering & Research), Prayagraj, India
- **Affiliated University:** Abdul Kalam Technical University (AKTU)
- **Scope:** Web-based smart campus platform; scalable to 800+ AKTU-affiliated engineering colleges

---

## Problem Being Solved

Traditional campus management relies on paper attendance registers, QR-code check-ins, and flat map overlays. These systems share four fundamental gaps:

1. **Proxy Attendance / Manual Fraud** — Roll-call and register-based attendance cannot verify physical presence in a classroom, allowing proxy attendance and administrative inaccuracy.
2. **No Real-Time Location Visibility** — Administrators and faculty have no tool to see where students or staff are at any given moment across the campus.
3. **Reactive Security** — Without live tracking, emergency response is delayed; unauthorized movement and unexpected exits go undetected.
4. **No Resource / Crowd Insights** — Campus planners lack occupancy and footfall data needed for scheduling, infrastructure, and resource allocation.
5. **Fragmented Systems** — Attendance, access control, and administration run as siloed tools, preventing a unified operational view.

---

## Solution Overview

A **photorealistic, geo-registered 3D digital model** of the campus rendered in a web browser, with **real-time GPS-based positions** of students and faculty overlaid on it.

Key differentiators:
- Drone photogrammetry generates the 3D model (not hand-built or CAD-based).
- All tracking is **bounded by a campus geofence** — the moment a user steps outside, tracking stops automatically.
- No cameras, no video — purely GPS-based.
- ERP credential login; no separate registration.
- New campuses can be onboarded in 3–5 days via a single drone survey, with **zero code changes** to the core backend.

---

## System Architecture (Five Layers)

| Layer | Purpose | Key Tools |
|---|---|---|
| Data Acquisition | Aerial imagery of campus | UAV / Drone |
| 3D Modeling | SfM point cloud → textured mesh | Agisoft Metashape |
| GIS & Geofencing | Spatial alignment, boundary definition | QGIS, GCPs, Shapefiles |
| Backend & Tracking | GPS ingestion, geofence validation, attendance logic | Spring Boot, WebSocket (STOMP), JWT, PostgreSQL |
| Visualization | 3D model render, live user pins | Three.js, React.js, Leaflet.js, OpenStreetMap |

---

## Phase-by-Phase Methodology

### Phase 1 — Drone-Based 3D Campus Model Generation
- UAV performs an aerial survey of UCER Prayagraj capturing high-resolution overlapping images.
- Images processed in **Agisoft Metashape** using **Structure-from-Motion (SfM)** → dense point cloud → textured 3D mesh.
- Output format: **GLB / OBJ** (browser-ready).

### Phase 2 — GIS Integration & Geofence Design
- 3D model imported into **QGIS**.
- **Ground Control Points (GCPs)** used to align model with real-world GPS coordinates.
- Campus features (blocks, roads, amenities) tagged as **shapefiles**.
- **Geofence polygon** drawn around campus boundary.
- **OpenStreetMap (XYZ tiles)** configured as base layer for visual context.

### Phase 3 — Backend & Real-Time Tracking Engine
- **Spring Boot** exposes REST APIs for auth, session management, attendance logic, geofence checks.
- Post ERP login, a **JWT token** is issued.
- Device sends GPS coordinates periodically via **WebSocket (STOMP)**.
- Each coordinate undergoes a **Point-in-Polygon check**:
  - **Inside geofence** → coordinate broadcast, attendance logged to PostgreSQL, map updated.
  - **Outside geofence** → session terminated, WebSocket closed, no data stored.
- **PostgreSQL** is the single database for user profiles, GPS location history, attendance, alerts, and campus event records.

### Phase 4 — Frontend & 3D Visualization
- **React.js** builds the web UI: GPS permission flow, campus map viewer, role-based dashboards.
- **Three.js** renders the GLB/OBJ 3D campus model in-browser with live user marker overlays.
- **Leaflet.js** renders the OpenStreetMap base tile layer beneath the 3D model for geographic context.
- **WebSocket** pushes real-time position updates to the frontend without page refreshes.
- **Role-based access control (RBAC):**
  - Students — see own position
  - Faculty — see their class/zone
  - Administrators — full campus view

### Phase 5 — Cloud Deployment
- All services packaged as **Docker containers** (backend, frontend, databases).
- **Multi-tenant cloud architecture** — multiple campuses share infrastructure, isolated by tenant.
- Consistent behaviour across development, staging, and production environments.

---

## Core Algorithm / Workflow

```
1. Drone survey → Agisoft Metashape SfM → Textured 3D model (GLB)
2. QGIS: load model, align with GCPs, tag features, export geofence polygon
3. User logs in via ERP credentials → Backend issues JWT
4. Frontend requests GPS permission:
     - Granted → live tracking begins
     - Denied  → map-view-only mode
5. Device sends GPS coordinates → Backend via WebSocket
6. Backend: Point-in-Polygon check against geofence
     - Inside  → broadcast to frontend and store location/attendance records in PostgreSQL
     - Outside → terminate session, close WebSocket, stop data collection
7. Frontend: update user pins on 3D map in real time
8. Attendance: match coordinates to classroom polygon during scheduled class hours
9. Logout / boundary exit → session ends, all connections closed
```

---

## Technology Stack

### Frontend
| Technology | Role |
|---|---|
| React.js | Web UI framework; GPS flow, dashboards, role-based views |
| Three.js | 3D model rendering; live user marker overlays |
| Leaflet.js | OpenStreetMap tile rendering for geographic context |
| OpenStreetMap | Open-source base map tiles (XYZ endpoints) |

### Backend
| Technology | Role |
|---|---|
| Spring Boot | REST API framework; auth, sessions, geofencing, attendance logic |
| WebSocket (STOMP) | Real-time bi-directional GPS data streaming |
| JWT | Stateless, secure authentication |
| Point-in-Polygon | Geofence boundary validation algorithm |

### Databases
| Database | Type | Purpose |
|---|---|---|
| PostgreSQL | Relational | User profiles, location history, attendance, alerts, and campus event records |

### DevOps & Tools
| Tool | Role |
|---|---|
| Docker | Containerisation for consistent multi-environment deployment |
| Agisoft Metashape | SfM photogrammetry — point cloud + 3D mesh generation |
| QGIS | GIS alignment, shapefile creation, geofence design |
| UAV / Drone | Aerial image capture for photogrammetry |

### Programming Languages
| Language | Usage |
|---|---|
| Java | Primary — Spring Boot backend, React/Three.js/Leaflet frontend |
| Python | Auxiliary — geospatial scripts, Metashape automation, shapefile parsing |

---

## Expected Performance Targets

| Metric | Target |
|---|---|
| 3D model positional accuracy | Sub-decimeter vs. ground measurements |
| GPS accuracy (open areas) | ≤ 3 m |
| GPS accuracy (near buildings) | ≤ 8 m |
| WebSocket update latency | < 300 ms on 4G |
| Bandwidth per user | < 50 kbps |
| Concurrent users per campus | ≥ 500 |
| Geofence validation time | < 500 ms |
| Attendance accuracy vs. manual | > 95% |

---

## Objectives (Summarised)

1. Real-time GPS tracking of students and faculty within campus
2. Automated GPS-based attendance (no manual input)
3. Bunk / absence detection with real-time alerts
4. 3D campus map with live user position overlays
5. Crowd monitoring for safety and resource planning
6. Secure, role-controlled data access
7. Anomaly detection for unusual movement patterns
8. Scalable multi-campus deployment architecture

---

## Project Scope

### In Scope
- GPS-based tracking of logged-in users within campus boundaries
- Photorealistic 3D campus model via drone survey
- Geofence-enforced automatic tracking termination on exit
- ERP credential login (no separate account creation)
- Role-based dashboards (student / faculty / admin)
- Automated attendance based on classroom geolocation during class hours
- Cloud deployment; multi-campus scalability

### Out of Scope
- Precise indoor tracking (floor-level or room-level via BLE/Wi-Fi)
- Non-GPS or GPS-disabled devices
- Camera / video surveillance integration
- Native mobile apps (Android / iOS) — web-only in Phase 1
- Bus / transport tracking
- Hostel / residential monitoring

---

## Privacy & Security Design

- **Geofence-first** — no location data is collected, stored, or transmitted outside the campus boundary.
- Tracking only activates **after explicit GPS permission grant** by the user.
- **JWT** ensures only authenticated ERP users access the system.
- **RBAC** prevents students from viewing other students' locations.
- Session auto-terminates on logout, app close, or boundary exit.

---

## Scalability Model

- Core backend is **campus-agnostic** — no code changes required for a new campus.
- Onboarding a new campus = drone survey (1–2 days) + QGIS processing + geofence definition (3–5 days total).
- Multi-tenant cloud architecture supports all AKTU-affiliated institutions (800+) on shared infrastructure.
- Commercial deployment pathway is built into the architecture.

---

## Glossary

| Term | Definition |
|---|---|
| SfM (Structure-from-Motion) | Photogrammetry technique that reconstructs 3D geometry from overlapping 2D images |
| GCP (Ground Control Point) | Known real-world coordinate used to align a 3D model to GPS space |
| Geofence | A virtual geographic boundary; triggers actions when entered or exited |
| GLB / OBJ | 3D model file formats usable in browsers (Three.js) |
| QGIS | Open-source Geographic Information System desktop application |
| Shapefile | Vector data format for storing geospatial features (polygons, lines, points) |
| Point-in-Polygon | Algorithm that checks whether a GPS coordinate falls inside a polygon boundary |
| STOMP | Simple Text Oriented Messaging Protocol; used over WebSocket for pub/sub messaging |
| JWT (JSON Web Token) | Compact, URL-safe token for stateless authentication |
| RBAC | Role-Based Access Control — permissions tied to user roles |
| ERP | Enterprise Resource Planning system used by the institution for student/staff records |
| UAV | Unmanned Aerial Vehicle (drone) |
| GeoJSON | JSON format for encoding geographic data structures |
| Multi-tenant | Architecture where a single application instance serves multiple isolated customers |
