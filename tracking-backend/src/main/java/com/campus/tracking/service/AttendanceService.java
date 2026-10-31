package com.campus.tracking.service;

import com.campus.tracking.model.AttendanceRecord;
import com.campus.tracking.model.Alert;
import com.campus.tracking.repository.AttendanceRecordRepository;
import com.campus.tracking.repository.AlertRepository;
import com.campus.tracking.repository.ClassroomRepository;
import com.campus.tracking.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.LocalDateTime;

/** Ad-hoc attendance marks made by an admin, outside the timetable (timetabled sessions use {@link AttendanceEngine}). */
@Service
public class AttendanceService {

    @Autowired
    private AttendanceRecordRepository attendanceRecordRepository;

    @Autowired
    private AlertRepository alertRepository;

    @Autowired
    private ClassroomRepository classroomRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private Clock clock;

    public AttendanceRecord markPresent(Long userId, String classroomCode, Long markedBy) {
        return save(userId, classroomCode, AttendanceRecord.Status.PRESENT, markedBy);
    }

    public AttendanceRecord markBunked(Long userId, String classroomCode, Long markedBy) {
        AttendanceRecord saved = save(userId, classroomCode, AttendanceRecord.Status.BUNKED, markedBy);

        String student = userRepository.findById(userId).map(u -> u.getName()).orElse("User " + userId);
        Alert alert = new Alert();
        alert.setUserId(userId);
        alert.setType(Alert.AlertType.BUNK_DETECTED);
        alert.setMessage(student + " was marked as bunking " + saved.getClassroomId());
        alert.setCreatedAt(LocalDateTime.now(clock));
        alertRepository.save(alert);

        return saved;
    }

    private AttendanceRecord save(Long userId, String classroomCode, AttendanceRecord.Status status, Long markedBy) {
        AttendanceRecord record = new AttendanceRecord();
        record.setUserId(userId);
        // A known classroom is stored under its canonical code so filters and reports line up.
        record.setClassroomId(classroomRepository.findByCodeIgnoreCase(classroomCode)
                .map(c -> c.getCode()).orElse(classroomCode));
        record.setStatus(status);
        record.setMethod(AttendanceRecord.Method.MANUAL);
        record.setMarkedBy(markedBy);
        record.setCheckTime(LocalDateTime.now(clock));
        return attendanceRecordRepository.save(record);
    }
}
