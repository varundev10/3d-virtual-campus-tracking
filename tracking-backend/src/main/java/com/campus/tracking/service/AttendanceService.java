package com.campus.tracking.service;

import com.campus.tracking.model.AttendanceRecord;
import com.campus.tracking.model.Alert;
import com.campus.tracking.model.Classroom;
import com.campus.tracking.repository.AttendanceRecordRepository;
import com.campus.tracking.repository.AlertRepository;
import com.campus.tracking.repository.ClassroomRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class AttendanceService {

    @Autowired
    private AttendanceRecordRepository attendanceRecordRepository;

    @Autowired
    private AlertRepository alertRepository;

    @Autowired
    private ClassroomRepository classroomRepository;

    private Classroom resolveClassroom(String classroomCode) {
        return classroomRepository.findByCode(classroomCode)
                .orElseThrow(() -> new IllegalArgumentException("Unknown classroom: " + classroomCode));
    }

    public AttendanceRecord markPresent(Long userId, String classroomCode) {
        AttendanceRecord record = new AttendanceRecord();
        record.setUserId(userId);
        record.setClassroom(resolveClassroom(classroomCode));
        record.setStatus(AttendanceRecord.Status.PRESENT);
        return attendanceRecordRepository.save(record);
    }

    public AttendanceRecord markBunked(Long userId, String classroomCode) {
        AttendanceRecord record = new AttendanceRecord();
        record.setUserId(userId);
        record.setClassroom(resolveClassroom(classroomCode));
        record.setStatus(AttendanceRecord.Status.BUNKED);
        AttendanceRecord saved = attendanceRecordRepository.save(record);

        Alert alert = new Alert();
        alert.setUserId(userId);
        alert.setType(Alert.AlertType.BUNK_DETECTED);
        alert.setMessage("Student " + userId + " marked BUNKED for " + classroomCode);
        alertRepository.save(alert);

        return saved;
    }
}
