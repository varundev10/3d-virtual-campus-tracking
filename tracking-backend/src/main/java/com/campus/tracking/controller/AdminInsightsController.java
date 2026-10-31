package com.campus.tracking.controller;

import com.campus.tracking.dto.AcademicViews.AttendanceSummary;
import com.campus.tracking.model.AttendanceRecord;
import com.campus.tracking.model.ClassSession;
import com.campus.tracking.model.Department;
import com.campus.tracking.model.User;
import com.campus.tracking.repository.AttendanceRecordRepository;
import com.campus.tracking.repository.ClassSessionRepository;
import com.campus.tracking.repository.DepartmentRepository;
import com.campus.tracking.repository.UserRepository;
import com.campus.tracking.service.AttendanceStats;
import com.campus.tracking.service.CrowdService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

// Occupancy, footfall, attendance reporting and CSV export. Admin only (SecurityConfig: /api/admin/**).
@RestController
@RequestMapping("/api/admin")
public class AdminInsightsController {

    private static final int MAX_REPORT_DAYS = 92;
    private static final int MAX_EXPORT_ROWS = 50_000;
    private static final int LOW_ATTENDANCE_LIMIT = 50;

    public record DepartmentRow(Long id, String code, String name, int students, long total, long present,
                                long absent, long bunked, double percent) {
    }

    public record LowAttendance(Long userId, String name, String email, String departmentName, double percent,
                                long total, long bunked) {
    }

    public record AttendanceReport(LocalDate from, LocalDate to, double requiredPercent, long total, double overallPercent,
                                   List<DepartmentRow> departments, List<LowAttendance> belowRequired) {
    }

    @Autowired
    private CrowdService crowdService;

    @Autowired
    private AttendanceStats stats;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private DepartmentRepository departmentRepository;

    @Autowired
    private ClassSessionRepository sessionRepository;

    @Autowired
    private AttendanceRecordRepository attendanceRepository;

    @Autowired
    private Clock clock;

    // Counts only; never who is where.
    @GetMapping("/crowd")
    public CrowdService.Snapshot crowd(@RequestParam(defaultValue = "10") int windowMinutes) {
        return crowdService.snapshot(windowMinutes);
    }

    @GetMapping("/reports/footfall")
    public Map<String, Object> footfall(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        LocalDate day = date != null ? date : LocalDate.now(clock);
        long[] perHour = crowdService.footfall(day);
        int peakHour = 0;
        for (int h = 1; h < perHour.length; h++) if (perHour[h] > perHour[peakHour]) peakHour = h;

        List<Map<String, Object>> hours = new ArrayList<>();
        for (int h = 0; h < perHour.length; h++) hours.add(Map.of("hour", h, "people", perHour[h]));
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("date", day.toString());
        body.put("hours", hours);
        body.put("peakHour", perHour[peakHour] == 0 ? null : peakHour);
        body.put("peakPeople", perHour[peakHour]);
        return body;
    }

    @GetMapping("/reports/attendance")
    public AttendanceReport attendanceReport(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) Long departmentId) {
        LocalDate end = to != null ? to : LocalDate.now(clock);
        LocalDate start = from != null ? from : end.minusDays(29);
        checkRange(start, end);

        List<User> students = userRepository.findAll().stream()
                .filter(u -> u.getRole() == User.Role.STUDENT && u.getActive())
                .filter(u -> departmentId == null || u.getDepartment() != null && departmentId.equals(u.getDepartment().getId()))
                .toList();
        Map<Long, AttendanceSummary> summaries = stats.summaries(students.stream().map(User::getId).toList(), start, end);

        List<DepartmentRow> rows = new ArrayList<>();
        long grandTotal = 0, grandPresent = 0;
        for (Department d : departmentRepository.findAllByOrderByNameAsc()) {
            if (departmentId != null && !departmentId.equals(d.getId())) continue;
            List<User> members = students.stream()
                    .filter(u -> u.getDepartment() != null && u.getDepartment().getId().equals(d.getId())).toList();
            long total = 0, present = 0, absent = 0, bunked = 0;
            for (User u : members) {
                AttendanceSummary s = summaries.get(u.getId());
                total += s.total();
                present += s.present();
                absent += s.absent();
                bunked += s.bunked();
            }
            rows.add(new DepartmentRow(d.getId(), d.getCode(), d.getName(), members.size(), total, present, absent,
                    bunked, AttendanceStats.percent(present, total)));
            grandTotal += total;
            grandPresent += present;
        }

        List<LowAttendance> low = students.stream()
                .filter(u -> summaries.get(u.getId()).total() > 0
                        && summaries.get(u.getId()).overallPercent() < stats.requiredPercent())
                .map(u -> {
                    AttendanceSummary s = summaries.get(u.getId());
                    return new LowAttendance(u.getId(), u.getName(), u.getEmail(), u.getDepartmentName(),
                            s.overallPercent(), s.total(), s.bunked());
                })
                .sorted(Comparator.comparingDouble(LowAttendance::percent).thenComparing(LowAttendance::name))
                .limit(LOW_ATTENDANCE_LIMIT)
                .toList();
        return new AttendanceReport(start, end, stats.requiredPercent(), grandTotal,
                AttendanceStats.percent(grandPresent, grandTotal), rows, low);
    }

    @GetMapping("/attendance/export")
    public ResponseEntity<byte[]> exportAttendance(
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) AttendanceRecord.Status status,
            @RequestParam(required = false) String classroomId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        LocalDate end = to != null ? to : LocalDate.now(clock);
        LocalDate start = from != null ? from : end.minusDays(29);
        checkRange(start, end);

        var records = attendanceRepository.findAll(
                AdminController.attendanceSpec(userId, status, classroomId, start, end),
                PageRequest.of(0, MAX_EXPORT_ROWS, Sort.by(Sort.Direction.DESC, "checkTime"))).getContent();

        Map<Long, User> users = userRepository.findAllById(
                        records.stream().map(AttendanceRecord::getUserId).collect(Collectors.toSet()))
                .stream().collect(Collectors.toMap(User::getId, Function.identity()));
        Map<Long, ClassSession> sessions = sessionRepository.findAll().stream()
                .collect(Collectors.toMap(ClassSession::getId, Function.identity()));

        StringBuilder csv = new StringBuilder("Date,Time,Student,Email,Department,Subject,Classroom,Status,Method,Note\r\n");
        for (AttendanceRecord r : records) {
            User u = users.get(r.getUserId());
            ClassSession s = r.getSessionId() == null ? null : sessions.get(r.getSessionId());
            appendRow(csv,
                    r.getCheckTime().toLocalDate().toString(),
                    r.getCheckTime().toLocalTime().withNano(0).toString(),
                    u == null ? "User " + r.getUserId() : u.getName(),
                    u == null ? "" : u.getEmail(),
                    u == null || u.getDepartmentName() == null ? "" : u.getDepartmentName(),
                    s == null ? "" : s.getSubject(),
                    r.getClassroomId(),
                    r.getStatus().name(),
                    r.getMethod() == null ? AttendanceRecord.Method.MANUAL.name() : r.getMethod().name(),
                    r.getNote() == null ? "" : r.getNote());
        }

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"attendance-" + start + "-to-" + end + ".csv\"")
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .body(csv.toString().getBytes(StandardCharsets.UTF_8));
    }

    private static void appendRow(StringBuilder out, String... cells) {
        for (int i = 0; i < cells.length; i++) {
            if (i > 0) out.append(',');
            out.append(csvCell(cells[i]));
        }
        out.append("\r\n");
    }

    /**
     * Quotes a CSV cell and defuses spreadsheet formulas: names and notes are user-supplied, and a cell starting
     * with = + - @ would otherwise execute when the export is opened in Excel or Sheets.
     */
    static String csvCell(String value) {
        String cell = value == null ? "" : value;
        if (!cell.isEmpty() && "=+-@\t\r".indexOf(cell.charAt(0)) >= 0) cell = "'" + cell;
        if (cell.contains(",") || cell.contains("\"") || cell.contains("\n") || cell.contains("\r")) {
            cell = "\"" + cell.replace("\"", "\"\"") + "\"";
        }
        return cell;
    }

    private static void checkRange(LocalDate start, LocalDate end) {
        if (start.isAfter(end)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The start date must be on or before the end date");
        }
        if (ChronoUnit.DAYS.between(start, end) >= MAX_REPORT_DAYS) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Date range can be at most " + MAX_REPORT_DAYS + " days");
        }
    }
}
