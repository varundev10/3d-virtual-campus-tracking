# 3D Virtual Campus Frontend

React frontend for the UCER smart campus tracking backend.

## Run

```powershell
npm install
npm run dev
```

The app runs on `http://127.0.0.1:5173` and expects the Spring Boot backend on `http://localhost:8080`.

## Campus 3D Tiles

The UCER Metashape 3D Tiles export is loaded from
`public/models/ucer-campus-tiles/tileset.json`. The campus tile files are large runtime
assets and are excluded from Git. For a fresh checkout, extract the contents of
`ucer-campus-tiles.3tz` into `public/models/ucer-campus-tiles/`, preserving the
`tileset.json` and `Data/` paths. The viewer streams the tile levels it needs as you
zoom and rotate the 3D campus.

## Backend alignment

- Reads users from `GET /api/users`
- Creates users with `POST /api/users`
- Sends GPS pings to `POST /api/locations`
- Reads recent user pings from `GET /api/locations/{userId}/recent`
- Marks attendance with `POST /api/attendance/present` and `POST /api/attendance/bunk`
- Receives live pings from SockJS/STOMP `/ws` topic `/topic/locations`

Future JWT/session/geofence changes should be added in `src/lib/api.js` and `src/lib/liveLocations.js`.
