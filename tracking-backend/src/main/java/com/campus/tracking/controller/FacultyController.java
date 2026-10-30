package com.campus.tracking.controller;

import com.campus.tracking.dto.AcademicViews.AttendanceSummary;
import com.campus.tracking.dto.AcademicViews.Roster;
import com.campus.tracking.dto.AcademicViews.SessionView;
import com.campus.tracking.dto.MarkAttendanceRequest;
import com.campus.tracking.model.AttendanceRecord;
import com.campus.tracking.model.ClassSession;
import com.campus.tracking.model.User;
import com.campus.tracking.repository.AlertRepository;
import com.campus.tracking.repository.ClassSessionRepository;
import com.campus.tracking.repository.UserRepository;
import com.campus.tracking.security.AccessScope;
import com.campus.tracking.service.AttendanceEngine;
import com.campus.tracking.service.AttendanceStats;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Clock;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

// Faculty (and admin) tools: the sessions they run, live rosters, manual marks and their department's students.
// Restricted to ROLE_FACULTY / ROLE_ADMIN by SecurityConfig; record-level rules come from AccessScope.
@RestController
@RequestMapping("/api/faculty")
public class FacultyController {

    private static final int SUMMARY_DAYS = 30;

    public record TodaySession(SessionView session, String state, int expected, long present, long absent,
                               long bunked, long pending) {
    }

    public record Overview(LocalDate today, DayOfWeek dayOfWeek, Long departmentId, String departmentName,
                           boolean headOfDepartment, int students, long openAlerts, double requiredPercent,
                           List<TodaySession> sessions) {
    }

    public record StudentRow(Long id, String name, String email, String departmentName, double percent, long total,
                             long present, long bunked, boolean belowRequired) {
    }

    @Autowired
    private AccessScope scope;

    @Autowired
    private ClassSessionRepository sessionRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private AlertRepository alertRepository;

    @Autowired
    private AttendanceEngine engine;

    @Autowired
    private AttendanceStats stats;

    @Autowired
    private Clock clock;

    private List<ClassSession> sessionsFor(User caller) {
        if (AccessScope.isAdmin(caller)) return sessionRepository.findAllByOrderByDayOfWeekAscStartTimeAsc();
        // -1 never matches a department, and avoids an empty IN list.
        List<Long> headed = AccessScope.heads(caller, caller.getDepartment())
                ? List.of(caller.getDepartment().getId()) : List.of(-1L);
        return sessionRepository.findTaughtByOrInDepartments(caller.getId(), headed);
    }

    @GetMapping("/sessions")
    public List<SessionView> sessions() {
        return sessionsFor(scope.caller()).stream().map(SessionView::of).toList();
    }

    @GetMapping("/overview")
    public Overview overview() {
        User caller = scope.caller();
        LocalDateTime now = LocalDateTime.now(clock);
        LocalDate today = now.toLocalDate();

        List<TodaySession> items = new ArrayList<>();
        for (ClassSession s : sessionsFor(caller)) {
            if (!s.isActiveSlot() || s.getDayOfWeek() != today.getDayOfWeek()) continue;
            Roster roster = engine.roster(s, today);
            long present = roster.entries().stream().filter(e -> e.status() == AttendanceRecord.Status.PRESENT).count();
            long absent = roster.entries().stream().filter(e -> e.status() == AttendanceRecord.Status.ABSENT).count();
            long bunked = roster.entries().stream().filter(e -> e.status() == AttendanceRecord.Status.BUNKED).count();
            String state = now.toLocalTime().isBefore(s.getStartTime()) ? "UPCOMING"
                    : now.toLocalTime().isAfter(s.getEndTime()) ? "ENDED" : "LIVE";
            items.add(new TodaySession(SessionView.of(s), state, roster.entries().size(), present, absent, bunked,
                    roster.entries().size() - present - absent - bunked));
        }
        items.sort(Comparator.comparing(i -> i.session().startTime()));

        int students = caller.getDepartment() == null ? 0
                : userRepository.findActiveByDepartmentAndRole(caller.getDepartment().getId(), User.Role.STUDENT).size();
        long openAlerts = alertRepository.count(AlertController.spec(scope.visibleUserIds(caller), false, null));
        return new Overview(today, today.getDayOfWeek(), caller.getDepartmentId(), caller.getDepartmentName(),
                caller.getHeadOfDepartment(), students, openAlerts, stats.requiredPercent(), items);
    }

    @GetMapping("/sessions/{id}/roster")
    public Roster roster(@PathVariable Long id,
                         @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        ClassSession session = scope.requireManageable(scope.caller(), requireSession(id));
        LocalDate day = date != null ? date : LocalDate.now(clock);
        if (day.getDayOfWeek() != session.getDayOfWeek()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "That session is held on " + session.getDayOfWeek() + ", not on " + day);
        }
        return engine.roster(session, day);
    }

    @PutMapping("/sessions/{id}/attendance")
    public AttendanceRecord mark(@PathVariable Long id, @Valid @RequestBody MarkAttendanceRequest request) {
        User caller = scope.caller();
        ClassSession session = scope.requireManageable(caller, requireSession(id));
        User student = userRepository.findById(request.getUserId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Student not found"));
        return engine.markManually(session, request.getDate(), student, request.getStatus(), caller, request.getNote());
    }

    @GetMapping("/students")
    public List<StudentRow> students() {
        User caller = scope.caller();
        List<User> students;
        if (AccessScope.isAdmin(caller)) {
            students = userRepository.findAll().stream().filter(u -> u.getRole() == User.Role.STUDENT).toList();
        } else if (caller.getDepartment() == null) {
            students = List.of();
        } else {
            students = userRepository.findActiveByDepartmentAndRole(caller.getDepartment().getId(), User.Role.STUDENT);
        }

        LocalDate today = LocalDate.now(clock);
        Map<Long, AttendanceSummary> summaries = stats.summaries(
                students.stream().map(User::getId).toList(), today.minusDays(SUMMARY_DAYS - 1L), today);
        return students.stream().map(u -> {
            AttendanceSummary s = summaries.get(u.getId());
            return new StudentRow(u.getId(), u.getName(), u.getEmail(), u.getDepartmentName(), s.overallPercent(),
                    s.total(), s.present(), s.bunked(), s.total() > 0 && s.overallPercent() < s.thresholdPercent());
        }).sorted(Comparator.comparingDouble(StudentRow::percent).thenComparing(StudentRow::name)).toList();
    }

    private ClassSession requireSession(Long id) {
        return sessionRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Session not found"));
    }
}
