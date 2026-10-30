package com.campus.tracking.service;

import com.campus.tracking.dto.AcademicViews;
import com.campus.tracking.model.*;
import com.campus.tracking.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * GPS-based attendance for timetabled sessions.
 *
 * <ul>
 *   <li>A student whose position falls inside the session's classroom while the session is running (or in the
 *       few minutes before it starts) is marked PRESENT, once, at the time they arrived.</li>
 *   <li>Shortly after the session ends, anyone still unmarked is finalized: BUNKED (with an alert) if they were
 *       on campus during the session but never entered the room, otherwise ABSENT.</li>
 *   <li>A faculty member who was never in the room during their own session raises a FACULTY_OFF_SCHEDULE alert.</li>
 *   <li>Manual marks by faculty or an admin always win over automatic ones.</li>
 * </ul>
 */
@Service
public class AttendanceEngine {

    private static final Logger log = LoggerFactory.getLogger(AttendanceEngine.class);
    private static final DateTimeFormatter HOUR_MINUTE = DateTimeFormatter.ofPattern("HH:mm");
    // A position older than this no longer counts as "in the room right now".
    private static final int LIVE_WINDOW_MINUTES = 5;
    private static final int MAX_CORRECTION_DAYS = 30;

    @Autowired
    private ClassSessionRepository sessionRepository;

    @Autowired
    private AttendanceRecordRepository attendanceRepository;

    @Autowired
    private SessionOutcomeRepository outcomeRepository;

    @Autowired
    private AlertRepository alertRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private LocationPingRepository pingRepository;

    @Autowired
    private Clock clock;

    // Students may arrive this long before a session starts and still count as present.
    @Value("${app.attendance.early-minutes:10}")
    private int earlyMinutes;

    // How long after a session ends before absentees are finalized.
    @Value("${app.attendance.grace-minutes:5}")
    private int graceMinutes;

    public static boolean insideRoom(Classroom room, LocationPing ping) {
        if (ping.getLatitude() == null || ping.getLongitude() == null) return false;
        double meters = GeoMath.distanceMeters(room.getLatitude(), room.getLongitude(),
                ping.getLatitude(), ping.getLongitude());
        if (meters > room.getRadiusMeters()) return false;
        Integer roomFloor = room.getFloorLevel();
        Integer pingFloor = ping.getFloorLevel();
        return roomFloor == null || pingFloor == null || roomFloor.equals(pingFloor);
    }

    /** Called after a position ping is stored. Marks the student present for any session they are in. */
    public void onPing(LocationPing ping) {
        if (ping.getLatitude() == null || ping.getLongitude() == null) return;
        User user = userRepository.findById(ping.getUserId()).orElse(null);
        if (user == null || user.getRole() != User.Role.STUDENT || user.getDepartment() == null) return;

        LocalDateTime at = ping.getTimestamp();
        LocalDate date = at.toLocalDate();
        for (ClassSession session : sessionRepository.findByDayOfWeek(date.getDayOfWeek())) {
            if (!session.isActiveSlot()) continue;
            if (!session.getDepartment().getId().equals(user.getDepartment().getId())) continue;
            if (at.isBefore(windowStart(session, date)) || at.isAfter(date.atTime(session.getEndTime()))) continue;
            if (!insideRoom(session.getClassroom(), ping)) continue;
            markArrival(user, session, date, at);
        }
    }

    private void markArrival(User student, ClassSession session, LocalDate date, LocalDateTime arrivedAt) {
        if (attendanceRepository.findByUserIdAndSessionIdAndSessionDate(student.getId(), session.getId(), date).isPresent()) {
            return;
        }
        AttendanceRecord record = newRecord(student.getId(), session, date, AttendanceRecord.Status.PRESENT);
        record.setCheckTime(arrivedAt);
        record.setMethod(AttendanceRecord.Method.AUTO);
        try {
            attendanceRepository.save(record);
        } catch (DataIntegrityViolationException e) {
            // A concurrent ping already recorded this student for the session.
        }
    }

    /** Finalizes every session that has ended and not yet been processed. Runs on a timer. */
    @Scheduled(fixedDelayString = "${app.attendance.sweep-seconds:60}", timeUnit = TimeUnit.SECONDS)
    public void sweep() {
        try {
            finalizeEnded(LocalDateTime.now(clock));
        } catch (RuntimeException e) {
            log.error("Attendance sweep failed", e);
        }
    }

    /** @return how many sessions were finalized. */
    public int finalizeEnded(LocalDateTime now) {
        int finalized = 0;
        // Yesterday too, so a restart overnight does not lose the evening's sessions.
        for (LocalDate date : List.of(now.toLocalDate().minusDays(1), now.toLocalDate())) {
            for (ClassSession session : sessionRepository.findByDayOfWeek(date.getDayOfWeek())) {
                if (!session.isActiveSlot()) continue;
                if (now.isBefore(date.atTime(session.getEndTime()).plusMinutes(graceMinutes))) continue;
                if (session.getUpdatedAt() != null && session.getUpdatedAt().isAfter(date.atTime(session.getStartTime()))) continue;
                if (outcomeRepository.existsBySessionIdAndSessionDate(session.getId(), date)) continue;
                finalizeSession(session, date, now);
                finalized++;
            }
        }
        return finalized;
    }

    private void finalizeSession(ClassSession session, LocalDate date, LocalDateTime now) {
        LocalDateTime from = windowStart(session, date);
        LocalDateTime to = date.atTime(session.getEndTime());
        String label = session.getSubject() + " (" + session.getClassroom().getCode() + ", "
                + session.getStartTime().format(HOUR_MINUTE) + "–" + session.getEndTime().format(HOUR_MINUTE) + ")";

        Map<Long, AttendanceRecord> existing = attendanceRepository.findBySessionIdAndSessionDate(session.getId(), date)
                .stream().collect(Collectors.toMap(AttendanceRecord::getUserId, Function.identity(), (a, b) -> a));

        int present = 0, absent = 0, bunked = 0;
        for (User student : userRepository.findActiveByDepartmentAndRole(session.getDepartment().getId(), User.Role.STUDENT)) {
            AttendanceRecord record = existing.get(student.getId());
            AttendanceRecord.Status status;
            if (record != null) {
                status = record.getStatus();
            } else {
                boolean onCampus = pingRepository.existsByUserIdAndLatitudeNotNullAndTimestampBetween(student.getId(), from, to);
                status = onCampus ? AttendanceRecord.Status.BUNKED : AttendanceRecord.Status.ABSENT;
                AttendanceRecord created = newRecord(student.getId(), session, date, status);
                created.setCheckTime(to);
                created.setMethod(AttendanceRecord.Method.AUTO);
                try {
                    attendanceRepository.save(created);
                } catch (DataIntegrityViolationException e) {
                    continue; // marked by someone else in the meantime
                }
                if (status == AttendanceRecord.Status.BUNKED) {
                    raiseBunkAlert(student, "was on campus during " + label + " but never entered the classroom", now);
                }
            }
            switch (status) {
                case PRESENT -> present++;
                case ABSENT -> absent++;
                case BUNKED -> bunked++;
            }
        }

        User faculty = session.getFaculty();
        if (faculty != null && !facultyWasInRoom(faculty, session, from, to)) {
            Alert alert = new Alert();
            alert.setUserId(faculty.getId());
            alert.setType(Alert.AlertType.FACULTY_OFF_SCHEDULE);
            alert.setMessage(faculty.getName() + " was not in " + session.getClassroom().getCode() + " for " + label
                    + " on " + date);
            alert.setCreatedAt(now);
            alertRepository.save(alert);
        }

        SessionOutcome outcome = new SessionOutcome();
        outcome.setSessionId(session.getId());
        outcome.setSessionDate(date);
        outcome.setFinalizedAt(now);
        outcome.setPresent(present);
        outcome.setAbsent(absent);
        outcome.setBunked(bunked);
        try {
            outcomeRepository.save(outcome);
        } catch (DataIntegrityViolationException e) {
            log.debug("Session {} on {} was finalized concurrently", session.getId(), date);
        }
    }

    private boolean facultyWasInRoom(User faculty, ClassSession session, LocalDateTime from, LocalDateTime to) {
        return pingRepository.findPositionedBetween(faculty.getId(), from, to).stream()
                .anyMatch(ping -> insideRoom(session.getClassroom(), ping));
    }

    /**
     * A faculty member or admin records (or overrides) one student's attendance for a session on a date.
     * A manual mark replaces whatever was recorded automatically.
     */
    public AttendanceRecord markManually(ClassSession session, LocalDate date, User student,
                                         AttendanceRecord.Status status, User actor, String note) {
        LocalDate today = LocalDate.now(clock);
        if (date.isAfter(today)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Attendance cannot be recorded for a future date");
        }
        if (date.isBefore(today.minusDays(MAX_CORRECTION_DAYS))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Attendance can only be corrected within " + MAX_CORRECTION_DAYS + " days");
        }
        if (date.getDayOfWeek() != session.getDayOfWeek()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "That session is held on " + session.getDayOfWeek() + ", not on " + date);
        }
        if (student.getRole() != User.Role.STUDENT || student.getDepartment() == null
                || !student.getDepartment().getId().equals(session.getDepartment().getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "That student is not on this session's roster");
        }

        LocalDateTime now = LocalDateTime.now(clock);
        AttendanceRecord record = attendanceRepository
                .findByUserIdAndSessionIdAndSessionDate(student.getId(), session.getId(), date)
                .orElseGet(() -> newRecord(student.getId(), session, date, status));
        AttendanceRecord.Status previous = record.getId() == null ? null : record.getStatus();
        record.setStatus(status);
        record.setMethod(AttendanceRecord.Method.MANUAL);
        record.setMarkedBy(actor.getId());
        record.setNote(note == null || note.isBlank() ? null : note.trim());
        record.setCheckTime(now);
        AttendanceRecord saved = attendanceRepository.save(record);

        if (status == AttendanceRecord.Status.BUNKED && previous != AttendanceRecord.Status.BUNKED) {
            raiseBunkAlert(student, "was marked as bunking " + session.getSubject() + " ("
                    + session.getClassroom().getCode() + ") by " + actor.getName(), now);
        }
        return saved;
    }

    /** The roster of a session on a date: every expected student with their status (null while pending). */
    public AcademicViews.Roster roster(ClassSession session, LocalDate date) {
        LocalDateTime now = LocalDateTime.now(clock);
        Map<Long, AttendanceRecord> records = attendanceRepository.findBySessionIdAndSessionDate(session.getId(), date)
                .stream().collect(Collectors.toMap(AttendanceRecord::getUserId, Function.identity(), (a, b) -> a));

        boolean live = date.equals(now.toLocalDate())
                && !now.isBefore(windowStart(session, date)) && !now.isAfter(date.atTime(session.getEndTime()));
        Set<Long> inRoom = live ? usersInRoomNow(session, now) : Set.of();

        List<AcademicViews.RosterEntry> entries = new ArrayList<>();
        for (User student : userRepository.findActiveByDepartmentAndRole(session.getDepartment().getId(), User.Role.STUDENT)) {
            AttendanceRecord r = records.get(student.getId());
            entries.add(new AcademicViews.RosterEntry(student.getId(), student.getName(), student.getEmail(),
                    r == null ? null : r.getStatus(), r == null ? null : r.getMethod(),
                    r == null ? null : r.getCheckTime(), r == null ? null : r.getNote(),
                    inRoom.contains(student.getId())));
        }
        boolean finalized = outcomeRepository.existsBySessionIdAndSessionDate(session.getId(), date);
        return new AcademicViews.Roster(AcademicViews.SessionView.of(session), date, finalized, live, entries);
    }

    private Set<Long> usersInRoomNow(ClassSession session, LocalDateTime now) {
        Set<Long> ids = new HashSet<>();
        for (LocationPing ping : pingRepository.findLatestPerUserSince(now.minusMinutes(LIVE_WINDOW_MINUTES))) {
            if (insideRoom(session.getClassroom(), ping)) ids.add(ping.getUserId());
        }
        return ids;
    }

    private LocalDateTime windowStart(ClassSession session, LocalDate date) {
        return date.atTime(session.getStartTime()).minusMinutes(earlyMinutes);
    }

    private static AttendanceRecord newRecord(Long userId, ClassSession session, LocalDate date,
                                              AttendanceRecord.Status status) {
        AttendanceRecord record = new AttendanceRecord();
        record.setUserId(userId);
        record.setClassroomId(session.getClassroom().getCode());
        record.setSessionId(session.getId());
        record.setSessionDate(date);
        record.setStatus(status);
        return record;
    }

    private void raiseBunkAlert(User student, String what, LocalDateTime at) {
        Alert alert = new Alert();
        alert.setUserId(student.getId());
        alert.setType(Alert.AlertType.BUNK_DETECTED);
        alert.setMessage(student.getName() + " " + what);
        alert.setCreatedAt(at);
        alertRepository.save(alert);
    }
}
