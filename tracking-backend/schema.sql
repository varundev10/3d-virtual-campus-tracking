-- 3D Virtual Campus Tracking System - relational database schema (MySQL 8+)
--
-- This is the canonical schema reference for the `campus_tracking` database. It documents
-- the tables the JPA entities in `com.campus.tracking.model` map to.
--
-- In development, Hibernate creates/updates these tables automatically
-- (spring.jpa.hibernate.ddl-auto=update in application.properties), so this file is NOT run
-- automatically on startup - it exists so the schema can be reviewed, provisioned by hand, or
-- handed to a DBA without needing to boot the application first.
--
-- Run manually with: mysql -u <user> -p campus_tracking < schema.sql

CREATE DATABASE IF NOT EXISTS campus_tracking
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE campus_tracking;

-- ---------------------------------------------------------------------------
-- departments
-- One row per academic department (e.g. Computer Science & Engineering).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS departments (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(150) NOT NULL,
  code        VARCHAR(20)  NOT NULL,
  CONSTRAINT uq_departments_code UNIQUE (code)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- users
-- Students, Teachers, and HODs all live in one table, disambiguated by `role`.
-- An HOD's own `department_id` is the department they head; a Student/Teacher's
-- `department_id` is the department they belong to.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(150) NOT NULL,
  email          VARCHAR(150) NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,
  role           ENUM('STUDENT', 'TEACHER', 'HOD') NOT NULL,
  department_id  BIGINT,
  CONSTRAINT uq_users_email UNIQUE (email),
  CONSTRAINT fk_users_department FOREIGN KEY (department_id)
    REFERENCES departments (id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE INDEX idx_users_department ON users (department_id);

-- ---------------------------------------------------------------------------
-- classrooms
-- Physical/logical rooms attendance is recorded against, scoped to a department.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS classrooms (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  code           VARCHAR(30) NOT NULL,
  building       VARCHAR(100),
  capacity       INT,
  department_id  BIGINT NOT NULL,
  CONSTRAINT uq_classrooms_code UNIQUE (code),
  CONSTRAINT fk_classrooms_department FOREIGN KEY (department_id)
    REFERENCES departments (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_classrooms_department ON classrooms (department_id);

-- ---------------------------------------------------------------------------
-- classroom_teachers
-- Many-to-many: which TEACHER-role users are assigned to which classroom.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS classroom_teachers (
  classroom_id  BIGINT NOT NULL,
  teacher_id    BIGINT NOT NULL,
  PRIMARY KEY (classroom_id, teacher_id),
  CONSTRAINT fk_classroom_teachers_classroom FOREIGN KEY (classroom_id)
    REFERENCES classrooms (id) ON DELETE CASCADE,
  CONSTRAINT fk_classroom_teachers_teacher FOREIGN KEY (teacher_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- location_pings
-- Raw GPS (or BLE/WiFi/RFID) position reports, one row per sample.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS location_pings (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id       BIGINT NOT NULL,
  latitude      DOUBLE,
  longitude     DOUBLE,
  beacon_id     VARCHAR(100),
  wifi_point_id VARCHAR(100),
  rfid_tag_id   VARCHAR(100),
  source        ENUM('GPS', 'BLE', 'WIFI', 'RFID') NOT NULL,
  timestamp     DATETIME NOT NULL,
  CONSTRAINT fk_location_pings_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_location_pings_user_time ON location_pings (user_id, timestamp DESC);

-- ---------------------------------------------------------------------------
-- attendance_records
-- One row per attendance mark (present/absent/bunked) for a user in a classroom.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance_records (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id       BIGINT NOT NULL,
  classroom_id  BIGINT NOT NULL,
  status        ENUM('PRESENT', 'ABSENT', 'BUNKED') NOT NULL,
  check_time    DATETIME NOT NULL,
  CONSTRAINT fk_attendance_records_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_attendance_records_classroom FOREIGN KEY (classroom_id)
    REFERENCES classrooms (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_attendance_records_user ON attendance_records (user_id);
CREATE INDEX idx_attendance_records_classroom ON attendance_records (classroom_id);

-- ---------------------------------------------------------------------------
-- alerts
-- System-generated notices (e.g. a bunk was detected) surfaced to HOD/Teacher dashboards.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alerts (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id     BIGINT NOT NULL,
  message     VARCHAR(500) NOT NULL,
  type        ENUM('BUNK_DETECTED', 'FACULTY_OFF_SCHEDULE') NOT NULL,
  created_at  DATETIME NOT NULL,
  CONSTRAINT fk_alerts_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_alerts_user ON alerts (user_id);
