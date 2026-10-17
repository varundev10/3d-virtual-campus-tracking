package com.campus.tracking.controller;

import com.campus.tracking.dto.PageResponse;
import com.campus.tracking.model.Alert;
import com.campus.tracking.model.AttendanceRecord;
import com.campus.tracking.model.LocationPing;
import com.campus.tracking.repository.*;
import jakarta.persistence.criteria.Predicate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;

// Every endpoint here is restricted to ROLE_ADMIN by SecurityConfig (/api/admin/**).
// All figures are computed from stored records; nothing is estimated or synthesised.
@RestController
@RequestMapping("/api/admin")
public class AdminController {

    // A user counts as "actively tracking" if they sent a ping within this window.
    static final int ACTIVE_WINDOW_MINUTES = 5;
    private static final int MAX_REPORT_DAYS = 92;
    private static final int MAX_PAGE_SIZE = 200;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CampusLocationRepository campusLocationRepository;

    @Autowired
    private LocationPingRepository locationPingRepository;

    @Autowired
    private AttendanceRecordRepository attendanceRecordRepository;

    @Autowired
    private AlertRepository alertRepository;

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> stats() {
        LocalDateTime now = LocalDateTime.now();
        long totalUsers = userRepository.count();
        long inactiveUsers = userRepository.countInactive();

        Map<String, Object> users = new LinkedHashMap<>();
        users.put("total", totalUsers);
        users.put("active", totalUsers - inactiveUsers);
        users.put("inactive", inactiveUsers);
        users.put("byRole", toCountMap(userRepository.countByRole()));

        Map<String, Object> locations = new LinkedHashMap<>();
        locations.put("total", campusLocationRepository.count());
        locations.put("byCategory", toCountMap(campusLocationRepository.countByCategory()));

        Map<String, Object> tracking = new LinkedHashMap<>();
        tracking.put("activeWindowMinutes", ACTIVE_WINDOW_MINUTES);
        tracking.put("activeUsers", locationPingRepository.countDistinctUsersSince(now.minusMinutes(ACTIVE_WINDOW_MINUTES)));
        tracking.put("pingsLast24h", locationPingRepository.countByTimestampAfter(now.minusHours(24)));
        tracking.put("pingsTotal", locationPingRepository.count());

        Map<String, Object> attendance = new LinkedHashMap<>();
        attendance.put("total", attendanceRecordRepository.count());
        attendance.put("byStatus", toCountMap(attendanceRecordRepository.countByStatus()));

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("generatedAt", now);
        body.put("users", users);
        body.put("locations", locations);
        body.put("tracking", tracking);
        body.put("attendance", attendance);
        body.put("alerts", Map.of("total", alertRepository.count()));
        return ResponseEntity.ok(body);
    }

    // Most recent ping for each user seen within the window.
    @GetMapping("/tracking/latest")
    public ResponseEntity<List<LocationPing>> latestPositions(@RequestParam(defaultValue = "60") int windowMinutes) {
        int window = Math.max(1, Math.min(windowMinutes, 7 * 24 * 60));
        return ResponseEntity.ok(locationPingRepository.findLatestPerUserSince(LocalDateTime.now().minusMinutes(window)));
    }

    @GetMapping("/pings")
    public ResponseEntity<PageResponse<LocationPing>> pings(
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) LocationPing.SourceType source,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size) {
        Specification<LocationPing> spec = (root, query, cb) -> {
            List<Predicate> p = new ArrayList<>();
            if (userId != null) p.add(cb.equal(root.get("userId"), userId));
            if (source != null) p.add(cb.equal(root.get("source"), source));
            if (from != null) p.add(cb.greaterThanOrEqualTo(root.get("timestamp"), from.atStartOfDay()));
            if (to != null) p.add(cb.lessThan(root.get("timestamp"), to.plusDays(1).atStartOfDay()));
            return cb.and(p.toArray(new Predicate[0]));
        };
        return ResponseEntity.ok(PageResponse.of(locationPingRepository.findAll(spec, pageable(page, size, "timestamp"))));
    }

    @GetMapping("/attendance")
    public ResponseEntity<PageResponse<AttendanceRecord>> attendance(
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) AttendanceRecord.Status status,
            @RequestParam(required = false) String classroomId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size) {
        Specification<AttendanceRecord> spec = (root, query, cb) -> {
            List<Predicate> p = new ArrayList<>();
            if (userId != null) p.add(cb.equal(root.get("userId"), userId));
            if (status != null) p.add(cb.equal(root.get("status"), status));
            if (classroomId != null && !classroomId.isBlank()) {
                p.add(cb.equal(cb.lower(root.get("classroomId")), classroomId.trim().toLowerCase(Locale.ROOT)));
            }
            if (from != null) p.add(cb.greaterThanOrEqualTo(root.get("checkTime"), from.atStartOfDay()));
            if (to != null) p.add(cb.lessThan(root.get("checkTime"), to.plusDays(1).atStartOfDay()));
            return cb.and(p.toArray(new Predicate[0]));
        };
        return ResponseEntity.ok(PageResponse.of(attendanceRecordRepository.findAll(spec, pageable(page, size, "checkTime"))));
    }

    @GetMapping("/alerts")
    public ResponseEntity<PageResponse<Alert>> alerts(
            @RequestParam(required = false) Alert.AlertType type,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size) {
        Specification<Alert> spec = (root, query, cb) -> {
            List<Predicate> p = new ArrayList<>();
            if (type != null) p.add(cb.equal(root.get("type"), type));
            if (from != null) p.add(cb.greaterThanOrEqualTo(root.get("createdAt"), from.atStartOfDay()));
            if (to != null) p.add(cb.lessThan(root.get("createdAt"), to.plusDays(1).atStartOfDay()));
            return cb.and(p.toArray(new Predicate[0]));
        };
        return ResponseEntity.ok(PageResponse.of(alertRepository.findAll(spec, pageable(page, size, "createdAt"))));
    }

    // Aggregates for the reports page over an inclusive date range (default: last 14 days).
    @GetMapping("/reports/activity")
    public ResponseEntity<Map<String, Object>> activityReport(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        LocalDate end = to != null ? to : LocalDate.now();
        LocalDate start = from != null ? from : end.minusDays(13);
        if (start.isAfter(end)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The start date must be on or before the end date");
        }
        if (ChronoUnit.DAYS.between(start, end) >= MAX_REPORT_DAYS) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Date range can be at most " + MAX_REPORT_DAYS + " days");
        }
        LocalDateTime fromTime = start.atStartOfDay();
        LocalDateTime toTime = end.plusDays(1).atStartOfDay();

        Map<LocalDate, Long> perDay = new TreeMap<>();
        for (LocalDate d = start; !d.isAfter(end); d = d.plusDays(1)) perDay.put(d, 0L);
        for (Object[] row : locationPingRepository.countPerDay(fromTime, toTime)) {
            perDay.put(toLocalDate(row[0]), ((Number) row[1]).longValue());
        }
        List<Map<String, Object>> pingsPerDay = new ArrayList<>();
        perDay.forEach((date, count) -> pingsPerDay.add(Map.of("date", date.toString(), "count", count)));

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("from", start.toString());
        body.put("to", end.toString());
        body.put("pingsPerDay", pingsPerDay);
        body.put("pingsBySource", toCountMap(locationPingRepository.countBySource(fromTime, toTime)));
        body.put("attendanceByStatus", toCountMap(attendanceRecordRepository.countByStatusBetween(fromTime, toTime)));
        body.put("alertsByType", toCountMap(alertRepository.countByTypeBetween(fromTime, toTime)));
        return ResponseEntity.ok(body);
    }

    private static PageRequest pageable(int page, int size, String sortField) {
        return PageRequest.of(Math.max(0, page), Math.max(1, Math.min(size, MAX_PAGE_SIZE)),
                Sort.by(Sort.Direction.DESC, sortField));
    }

    private static LocalDate toLocalDate(Object value) {
        if (value instanceof LocalDate date) return date;
        if (value instanceof java.sql.Date date) return date.toLocalDate();
        if (value instanceof LocalDateTime dateTime) return dateTime.toLocalDate();
        return LocalDate.parse(String.valueOf(value).substring(0, 10));
    }

    private static Map<String, Long> toCountMap(List<Object[]> rows) {
        Map<String, Long> map = new LinkedHashMap<>();
        for (Object[] row : rows) {
            if (row[0] != null) map.put(String.valueOf(row[0]), ((Number) row[1]).longValue());
        }
        return map;
    }
}
