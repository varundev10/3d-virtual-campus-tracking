# 3D Virtual Campus Frontend

React frontend for the UCER smart campus tracking backend.

## Run

```powershell
npm install
npm run dev
```

The app runs on `http://127.0.0.1:5173` and expects the Spring Boot backend on `http://localhost:8080`.

## Backend alignment

- Reads users from `GET /api/users`
- Creates users with `POST /api/users`
- Sends GPS pings to `POST /api/locations`
- Reads recent user pings from `GET /api/locations/{userId}/recent`
- Marks attendance with `POST /api/attendance/present` and `POST /api/attendance/bunk`
- Receives live pings from SockJS/STOMP `/ws` topic `/topic/locations`

Future JWT/session/geofence changes should be added in `src/lib/api.js` and `src/lib/liveLocations.js`.
