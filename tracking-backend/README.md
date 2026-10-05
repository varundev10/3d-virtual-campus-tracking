# Smart Campus Tracking System — Backend

Comprehensive backend for the Smart Campus Tracking System. This Spring Boot application provides REST APIs, persistent storage (PostgreSQL), and a real-time WebSocket/STOMP feed for live location updates. The README below explains how to set up, run, and extend the project.

## Features
- User management (create/list users)
- Location pings ingestion and retrieval
- Attendance recording
- Alerts model and storage
- Real-time location broadcast over WebSocket (STOMP)

## Tech stack
- Java 17
- Spring Boot 3.x
- Spring Data JPA (Hibernate)
- PostgreSQL 16+ (or compatible PostgreSQL release)
- Maven (wrapper included)
- WebSocket (STOMP)

## Repository layout
- `src/main/java/com/campus/tracking` - application code
	- `controller` - REST controllers
	- `service` - business logic
	- `repository` - Spring Data repositories
	- `model`/`dto` - domain models and DTOs
- `src/main/resources/application.properties` - runtime configuration
- `test.html` - small WebSocket test helper

## Prerequisites
- Java 17 or newer
- Maven or use the included `mvnw` wrapper
- PostgreSQL 16+
- (Optional) Docker

## Configuration
All runtime configuration lives in `src/main/resources/application.properties`. Set database credentials with environment variables; do not commit passwords.

Example minimal `application.properties` values to use locally:

```
spring.datasource.url=jdbc:postgresql://localhost:5432/campus_tracking
spring.datasource.username=campus_user
spring.datasource.password=<your-local-password>
spring.jpa.hibernate.ddl-auto=update
server.port=8080
```

The application supports `DB_URL`, `DB_USERNAME`, and `DB_PASSWORD` environment variables. Defaults point to the local `campus_tracking` database and user `campus_user`; set `DB_PASSWORD` before starting the backend.

For production, replace `ddl-auto=update` with migrations (Flyway/Liquibase) and use secure secret storage.

## Create database and user (PostgreSQL)
Run the following SQL as an administrative user to create the DB and user used above:

```sql
CREATE USER campus_user WITH PASSWORD 'choose-a-local-password';
CREATE DATABASE campus_tracking OWNER campus_user;
```

Adjust user/host/password as required. The `set-db-creds.ps1` helper can prompt for
these settings and start Spring Boot without saving the password in the properties
file.

## Current relational schema

Hibernate creates and updates the schema from the JPA entities because
`spring.jpa.hibernate.ddl-auto=update` is enabled for this prototype. The current
tables are `users`, `location_pings`, `attendance_records`, and `alerts`.
Their definitions live in `src/main/java/com/campus/tracking/model`. Location
coordinates are stored as latitude/longitude numeric columns. PostGIS is not
configured in this backend yet.

Location pings also carry an optional `floorLevel` (0 = ground floor). The 3D
viewer snaps each marker to the streamed model surface, then offsets upper floors
using the configurable 3.5 m floor-height estimate in the frontend. Replace that
estimate with surveyed floor elevations for building-accurate indoor positioning;
GPS alone does not determine a person's floor.

## Run the application
From the `tracking-backend` directory run:

Windows PowerShell
```powershell
./mvnw spring-boot:run
```

On PowerShell, configure the local database password in the same terminal first:

```powershell
$env:DB_PASSWORD = 'your-local-password'
./mvnw.cmd spring-boot:run
```

Or with a local Maven installation:
```powershell
mvn spring-boot:run
```

Build a jar:
```powershell
./mvnw clean package
java -jar target/*.jar
```

## HTTP API (examples)
The project exposes REST endpoints under `/api` (controllers are in `controller` package). Example endpoints (adjust paths if code differs):

- Create user (JSON):

	POST http://localhost:8080/api/users
	Body example:
	```json
	{"name":"Alice","email":"alice@example.com","role":"STUDENT"}
	```

- Post location ping:

	POST http://localhost:8080/api/locations
	Body example:
	```json
	{"userId":1,"latitude":12.3456,"longitude":78.9123,"timestamp":"2026-06-23T09:00:00Z"}
	```

- Attendance mark (example query params):

	POST http://localhost:8080/api/attendance/present?userId=1&classroomId=A-204

Check the controller classes in `src/main/java/com/campus/tracking/controller` for the exact request/response shapes and additional endpoints.

## WebSocket (real-time)
- WebSocket endpoint: `/ws` (STOMP)
- Topic for location broadcasts (example): `/topic/locations`

Quick test using the included `test.html`:
1. Open `test.html` in a browser.
2. Connect to `ws://localhost:8080/ws`.
3. Subscribe to `/topic/locations` to receive live location updates.

You can also use `wscat` or a STOMP client to test.

## Data model overview
- `User` - user metadata
- `LocationPing` - individual location updates
- `AttendanceRecord` - attendance entries
- `Alert` - stored alerts

Refer to the `model` package for field-level details and relationships.

## Testing
- Unit tests live in `src/test/java`.
- Run tests with:

```powershell
./mvnw test
```

## Docker (optional)
You can run PostgreSQL in Docker for local development:

```bash
docker run --name campus-postgres -e POSTGRES_DB=campus_tracking -e POSTGRES_USER=campus_user -e POSTGRES_PASSWORD=campus_dev_password -p 5432:5432 -d postgres:17
```

Then set `DB_PASSWORD=campus_dev_password` in the shell used to run Spring Boot.

## Troubleshooting
- Lombok: ensure Lombok plugin is enabled in your IDE.
- DB connection errors: verify `DB_URL`, `DB_USERNAME`, and `DB_PASSWORD`, and confirm PostgreSQL is listening on port 5432.
- Port conflicts: change `server.port` in `application.properties`.

## Contributing
- Fork, create a feature branch, implement changes, add tests, then open a PR.

## License & Contact
- License: add your preferred license file (e.g., `LICENSE`).
- Author / Maintainer: Shubham Jaiswal
- Repository: https://github.com/Shubham-Jaiswal5414/3dVirtual.git

If you'd like, I can also add examples of curl commands, Swagger/OpenAPI setup, or a Dockerfile.
