package com.campus.tracking.dto;

import com.campus.tracking.model.AttendanceRecord;
import com.campus.tracking.model.ClassSession;
import com.campus.tracking.model.Classroom;
import com.campus.tracking.model.Department;
import com.campus.tracking.model.User;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

/** Response shapes for the academics (departments, classrooms, timetable, attendance) endpoints. */
public final class AcademicViews {

    private AcademicViews() {
    }

    public record DepartmentView(Long id, String code, String name, Long headUserId, String headName,
                                 long students, long faculty) {
        public static DepartmentView of(Department d, String headName, long students, long faculty) {
            return new DepartmentView(d.getId(), d.getCode(), d.getName(), d.getHeadUserId(), headName, students, faculty);
        }
    }

    public record ClassroomView(Long id, String code, String name, String locationCode, double latitude,
                                double longitude, int radiusMeters, Integer floorLevel, Integer capacity,
                                Long departmentId, String departmentName) {
        public static ClassroomView of(Classroom c) {
            Department d = c.getDepartment();
            return new ClassroomView(c.getId(), c.getCode(), c.getName(), c.getLocationCode(), c.getLatitude(),
                    c.getLongitude(), c.getRadiusMeters(), c.getFloorLevel(), c.getCapacity(),
                    d == null ? null : d.getId(), d == null ? null : d.getName());
        }
    }

    public record SessionView(Long id, String subject, Long classroomId, String classroomCode, String classroomName,
                              Long departmentId, String departmentName, Long facultyId, String facultyName,
                              DayOfWeek dayOfWeek, LocalTime startTime, LocalTime endTime, boolean active) {
        public static SessionView of(ClassSession s) {
            User f = s.getFaculty();
            return new SessionView(s.getId(), s.getSubject(), s.getClassroom().getId(), s.getClassroom().getCode(),
                    s.getClassroom().getName(), s.getDepartment().getId(), s.getDepartment().getName(),
                    f == null ? null : f.getId(), f == null ? null : f.getName(), s.getDayOfWeek(),
                    s.getStartTime(), s.getEndTime(), s.isActiveSlot());
        }
    }

    /** One student's line on a session roster. {@code status} is null while attendance is still pending. */
    public record RosterEntry(Long userId, String name, String email, AttendanceRecord.Status status,
                              AttendanceRecord.Method method, LocalDateTime checkTime, String note,
                              boolean inRoomNow) {
    }

    public record Roster(SessionView session, LocalDate date, boolean finalized, boolean live,
                         java.util.List<RosterEntry> entries) {
    }

    /** A user's attendance for one subject over a period. */
    public record SubjectSummary(String subject, long present, long absent, long bunked, long total, double percent) {
    }

    public record AttendanceSummary(double overallPercent, long total, long present, long absent, long bunked,
                                    java.util.List<SubjectSummary> subjects, double thresholdPercent) {
    }
}
