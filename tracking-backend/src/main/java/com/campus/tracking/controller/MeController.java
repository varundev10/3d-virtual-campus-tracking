package com.campus.tracking.controller;

import com.campus.tracking.dto.AcademicViews.AttendanceSummary;
import com.campus.tracking.dto.AcademicViews.SessionView;
import com.campus.tracking.model.AttendanceRecord;
import com.campus.tracking.model.ClassSession;
import com.campus.tracking.model.User;
import com.campus.tracking.repository.AttendanceRecordRepository;
import com.campus.tracking.repository.ClassSessionRepository;
import com.campus.tracking.security.AccessScope;
import com.campus.tracking.service.AttendanceStats;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Clock;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

// The signed-in user's own timetable and attendance.
@RestController
@RequestMapping("/api/me")
public class MeController {

    private static final int MAX_SUMMARY_DAYS = 365;

    public record TodayRecord(Long sessionId, AttendanceRecord.Status status, AttendanceRecord.Method method,
                              LocalDateTime checkTime) {
    }

    public record Schedule(LocalDate today, DayOfWeek dayOfWeek, String timezone, Long departmentId,
                           String departmentName, List<SessionView> sessions, List<TodayRecord> todayRecords) {
    }

    @Autowired
    private AccessScope scope;

    @Autowired
    private ClassSessionRepository sessionRepository;

    @Autowired
    private AttendanceRecordRepository attendanceRepository;

    @Autowired
    private AttendanceStats stats;

    @Autowired
    private Clock clock;

    @Value("${app.campus.timezone:Asia/Kolkata}")
    private String timezone;

    @GetMapping("/schedule")
    public Schedule schedule() {
        User me = scope.caller();
        LocalDate today = LocalDate.now(clock);

        List<ClassSession> sessions;
        if (me.getRole() == User.Role.STUDENT && me.getDepartment() != null) {
            sessions = sessionRepository.findByDepartmentIdOrderByDayOfWeekAscStartTimeAsc(me.getDepartment().getId());
        } else if (me.getRole() == User.Role.FACULTY) {
            sessions = sessionRepository.findByFacultyIdOrderByDayOfWeekAscStartTimeAsc(me.getId());
        } else {
            sessions = List.of();
        }

        List<TodayRecord> records = attendanceRepository
                .findByUserIdInAndSessionDateBetween(List.of(me.getId()), today, today).stream()
                .map(r -> new TodayRecord(r.getSessionId(), r.getStatus(), r.getMethod(), r.getCheckTime())).toList();
        return new Schedule(today, today.getDayOfWeek(), timezone, me.getDepartmentId(), me.getDepartmentName(),
                sessions.stream().filter(ClassSession::isActiveSlot).map(SessionView::of).toList(), records);
    }

    @GetMapping("/attendance/summary")
    public AttendanceSummary summary(@RequestParam(defaultValue = "90") int days) {
        int span = Math.max(1, Math.min(days, MAX_SUMMARY_DAYS));
        LocalDate today = LocalDate.now(clock);
        return stats.summary(scope.caller().getId(), today.minusDays(span - 1L), today);
    }
}
