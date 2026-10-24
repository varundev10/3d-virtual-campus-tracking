# 3D Virtual Campus Frontend

React frontend for the UCER smart campus tracking backend.

## Run

```powershell
npm install
npm run dev
```

The app runs on `http://127.0.0.1:5173` and expects the Spring Boot backend on `http://localhost:8080`.
If you serve it from another origin, add that origin to the backend's `APP_CORS_ORIGINS`.

## Routes

| Path | Who | What |
|---|---|---|
| `/login`, `/register` | anyone | Sign in; self-registration always creates a STUDENT |
| `/app` | student / faculty | Dashboard: welcome, quick actions, campus directory, recent destinations, own pings and attendance |
| `/app/explore` | student / faculty | 3D campus explorer + OSM map, search, category filter, location details, GPS status, straight-line navigation |
| `/app/profile` | student / faculty | Account details, edit name, change password |
| `/admin` | admin | Overview stats from `/api/admin/stats` |
| `/admin/users` | admin | Search/filter users, add user, change role, activate/deactivate, set password, mark attendance |
| `/admin/locations` | admin | Campus location CRUD with validation and click-to-pick coordinates |
| `/admin/tracking` | admin | Live 3D + map view of latest positions (STOMP feed), ping history |
| `/admin/reports` | admin | Date-range reports: pings per day, by source, attendance, alerts |
| `/admin/settings` | admin | Own account, system status, geofence, local 3D model preview |

After sign-in the user is sent to `/admin` or `/app` based on the role returned by the server (`/api/auth/me`).
Admin pages show "Admin access required" for other roles, and every admin API is also enforced server-side.

The router uses the History API, so a production web server must serve `index.html` for unknown paths
(Vite's dev server and `vite preview` already do).

## Campus 3D Tiles

The UCER Metashape 3D Tiles export is loaded from
`public/models/ucer-campus-tiles/tileset.json`. The campus tile files are large runtime
assets and are excluded from Git. For a fresh checkout, extract the contents of
`ucer-campus-tiles.3tz` into `public/models/ucer-campus-tiles/`, preserving the
`tileset.json` and `Data/` paths. The viewer streams the tile levels it needs as you
zoom and rotate the 3D campus.

## Backend alignment

- Auth: `POST /api/auth/login`, `POST /api/auth/register`, `GET/PATCH /api/auth/me`, `PUT /api/auth/password`.
  The JWT is kept in `sessionStorage` (ends with the tab) and sent as `Authorization: Bearer …`.
- Users: `GET /api/users` (filters `q`, `role`, `active`), `POST /api/users`, `PATCH /api/users/{id}`, `PUT /api/users/{id}/password`
- Campus locations: `GET/POST /api/campus-locations`, `PUT/DELETE /api/campus-locations/{id}`
- Sends GPS pings to `POST /api/locations` (only when the user opts in and is inside the geofence)
- Reads recent user pings from `GET /api/locations/{userId}/recent`
- Marks attendance with `POST /api/attendance/present` and `POST /api/attendance/bunk`
- Admin data: `/api/admin/stats`, `/api/admin/tracking/latest`, `/api/admin/pings`, `/api/admin/attendance`, `/api/admin/alerts`, `/api/admin/reports/activity`
- Receives live pings from SockJS/STOMP `/ws` topic `/topic/locations` (admin token required in the CONNECT frame)

Location access is requested only when the user clicks "Use my location"; browsers allow it only over HTTPS or on localhost.
