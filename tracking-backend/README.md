# Smart Campus Tracking System — Backend

Comprehensive backend for the Smart Campus Tracking System. This Spring Boot application provides REST APIs, persistent storage (MySQL), and a real-time WebSocket/STOMP feed for live location updates. The README below explains how to set up, run, and extend the project.

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
- MySQL (or compatible relational DB)
- Maven (wrapper included)
- WebSocket (STOMP)

## Repository layout
- `src/main/java/com/campus/tracking` - application code
	- `controller` - REST controllers
	- `service` - business logic
	- `repository` - Spring Data repositories
	- `model`/`dto` - domain models and DTOs
- `src/main/resources/application.properties` - runtime configuration

## Prerequisites
- Java 17 or newer
- Maven or use the included `mvnw` wrapper
- MySQL 8.x (or compatible DB)
- (Optional) Docker

## Configuration
All runtime configuration lives in `src/main/resources/application.properties`. Before running, set your DB credentials there or via environment variables.

Example minimal `application.properties` values to use locally:

```
spring.datasource.url=jdbc:mysql://localhost:3306/campus_tracking?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC
spring.datasource.username=campus_user
spring.datasource.password=StrongPassword123!
spring.jpa.hibernate.ddl-auto=update
server.port=8080
```

For production, replace `ddl-auto=update` with migrations (Flyway/Liquibase) and use secure secret storage.

## Create database and user (MySQL)
Run the following SQL as an administrative user to create the DB and user used above:

```sql
CREATE DATABASE campus_tracking;
CREATE USER 'campus_user'@'localhost' IDENTIFIED BY 'StrongPassword123!';
GRANT ALL PRIVILEGES ON campus_tracking.* TO 'campus_user'@'localhost';
FLUSH PRIVILEGES;
```

Adjust user/host/password as required and update `application.properties`.

## Run the application
From the repository root (where `mvnw` is located) run:

Windows PowerShell
```powershell
./mvnw spring-boot:run
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

## Authentication and roles
All `/api/**` endpoints except `POST /api/auth/login` and `POST /api/auth/register` need an
`Authorization: Bearer <jwt>` header. Tokens are HS256 JWTs issued by the backend; on every request the
user's role and active status are re-read from the database, so role changes and deactivation apply immediately.

| Role | Can do |
|---|---|
| STUDENT / FACULTY | Read campus locations, read own user/pings/attendance, post own location pings, edit own name/password |
| ADMIN | Everything above plus `/api/admin/**`, user management, campus-location writes, attendance marking, the `/topic/locations` live feed |

Self-registration always creates a STUDENT. Admins are created from environment variables at startup
(nothing is created when they are absent) and can then promote other users.

Environment variables (referenced from `application.properties`):

| Variable | Purpose |
|---|---|
| `APP_JWT_SECRET` | JWT signing secret, at least 32 characters. If unset, a random one is generated and sessions end on restart. |
| `APP_JWT_EXPIRY_MINUTES` | Token lifetime, default 480 |
| `APP_ADMIN_EMAIL`, `APP_ADMIN_PASSWORD`, `APP_ADMIN_NAME` | Bootstrap admin. Created (or promoted) at startup; an existing password is never overwritten. |
| `APP_CORS_ORIGINS` | Comma-separated allowed browser origins, default `http://localhost:5173,http://127.0.0.1:5173` |

Example (PowerShell):
```powershell
$env:APP_JWT_SECRET = "<long random string>"
$env:APP_ADMIN_EMAIL = "admin@your-campus.edu"
$env:APP_ADMIN_PASSWORD = "<strong password>"
./mvnw spring-boot:run
```

Users created before authentication existed have no password; an admin can set one from the Users page.
Location pings outside the campus geofence (`GeofenceService`, mirrored from the frontend polygon) are rejected with 422 and never stored.

### Running without MySQL
`./mvnw spring-boot:test-run` starts the app against an in-memory H2 database using the test profile
(`src/test/resources/application-test.properties`, bootstrap admin `admin@test.local` / `AdminPass123`).
This is for local demos only; data is lost on shutdown and those credentials exist only on the test classpath.

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

The STOMP `CONNECT` frame must carry the same JWT used for REST calls, as an `Authorization: Bearer <token>` header
(get one from `POST /api/auth/login`). Only administrators may subscribe to `/topic/locations`. To test, use any STOMP
client with that header, or the admin Tracking page of the frontend, which connects this way.

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
You can run MySQL in Docker for local development:

```bash
docker run --name campus-mysql -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=campus_tracking -e MYSQL_USER=campus_user -e MYSQL_PASSWORD=StrongPassword123! -p 3306:3306 -d mysql:8
```

## Troubleshooting
- Lombok: ensure Lombok plugin is enabled in your IDE.
- DB connection errors: verify `spring.datasource.*` settings and that MySQL is accessible.
- Port conflicts: change `server.port` in `application.properties`.

## Contributing
- Fork, create a feature branch, implement changes, add tests, then open a PR.

## License & Contact
- License: add your preferred license file (e.g., `LICENSE`).
- Author / Maintainer: Shubham Jaiswal
- Repository: https://github.com/Shubham-Jaiswal5414/3dVirtual.git

If you'd like, I can also add examples of curl commands, Swagger/OpenAPI setup, or a Dockerfile.
