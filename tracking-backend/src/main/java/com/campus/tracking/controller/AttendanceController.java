package com.campus.tracking.controller;

import com.campus.tracking.model.AttendanceRecord;
import com.campus.tracking.repository.AttendanceRecordRepository;
import com.campus.tracking.service.AttendanceService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/attendance")
public class AttendanceController {

    @Autowired
    private AttendanceService attendanceService;

    @Autowired
    private AttendanceRecordRepository attendanceRecordRepository;

    @PostMapping("/present")
    public ResponseEntity<AttendanceRecord> markPresent(@RequestParam Long userId, @RequestParam String classroomId) {
        return ResponseEntity.ok(attendanceService.markPresent(userId, classroomId));
    }

    @PostMapping("/bunk")
    public ResponseEntity<AttendanceRecord> markBunked(@RequestParam Long userId, @RequestParam String classroomId) {
        return ResponseEntity.ok(attendanceService.markBunked(userId, classroomId));
    }

    @GetMapping("/{userId}")
    public ResponseEntity<List<AttendanceRecord>> getHistory(@PathVariable Long userId) {
        return ResponseEntity.ok(attendanceRecordRepository.findByUserId(userId));
    }
}
