package com.campus.tracking.service;

import com.campus.tracking.dto.AcademicViews.AttendanceSummary;
import com.campus.tracking.dto.AcademicViews.SubjectSummary;
import com.campus.tracking.model.AttendanceRecord;
import com.campus.tracking.model.ClassSession;
import com.campus.tracking.repository.AttendanceRecordRepository;
import com.campus.tracking.repository.ClassSessionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.*;

/**
 * Attendance percentages over timetabled sessions. A day counts as attended only when PRESENT; ABSENT and BUNKED
 * both count against the student. Ad-hoc admin marks (no session) are not part of the percentage.
 */
@Service
public class AttendanceStats {

    @Autowired
    private AttendanceRecordRepository attendanceRepository;

    @Autowired
    private ClassSessionRepository sessionRepository;

    @Value("${app.attendance.required-percent:75}")
    private double requiredPercent;

    public double requiredPercent() {
        return requiredPercent;
    }

    public static double percent(long present, long total) {
        return total == 0 ? 100.0 : Math.round(present * 1000.0 / total) / 10.0;
    }

    public AttendanceSummary summary(Long userId, LocalDate from, LocalDate to) {
        return summaries(List.of(userId), from, to).get(userId);
    }

    public Map<Long, AttendanceSummary> summaries(Collection<Long> userIds, LocalDate from, LocalDate to) {
        Map<Long, String> subjectBySession = new HashMap<>();
        for (ClassSession s : sessionRepository.findAll()) subjectBySession.put(s.getId(), s.getSubject());

        Map<Long, List<AttendanceRecord>> byUser = new HashMap<>();
        if (!userIds.isEmpty()) {
            for (AttendanceRecord r : attendanceRepository.findByUserIdInAndSessionDateBetween(userIds, from, to)) {
                byUser.computeIfAbsent(r.getUserId(), k -> new ArrayList<>()).add(r);
            }
        }

        Map<Long, AttendanceSummary> result = new LinkedHashMap<>();
        for (Long userId : userIds) {
            long present = 0, absent = 0, bunked = 0;
            Map<String, long[]> perSubject = new TreeMap<>();
            for (AttendanceRecord r : byUser.getOrDefault(userId, List.of())) {
                long[] counts = perSubject.computeIfAbsent(subjectBySession.getOrDefault(r.getSessionId(), "Other"), k -> new long[3]);
                switch (r.getStatus()) {
                    case PRESENT -> { present++; counts[0]++; }
                    case ABSENT -> { absent++; counts[1]++; }
                    case BUNKED -> { bunked++; counts[2]++; }
                }
            }
            long total = present + absent + bunked;
            List<SubjectSummary> subjects = new ArrayList<>();
            perSubject.forEach((subject, c) -> {
                long t = c[0] + c[1] + c[2];
                subjects.add(new SubjectSummary(subject, c[0], c[1], c[2], t, percent(c[0], t)));
            });
            result.put(userId, new AttendanceSummary(percent(present, total), total, present, absent, bunked,
                    subjects, requiredPercent));
        }
        return result;
    }
}
