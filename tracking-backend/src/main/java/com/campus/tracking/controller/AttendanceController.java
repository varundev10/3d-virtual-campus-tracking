package com.campus.tracking.controller;

import com.campus.tracking.model.AttendanceRecord;
import com.campus.tracking.repository.AttendanceRecordRepository;
import com.campus.tracking.repository.UserRepository;
import com.campus.tracking.security.CurrentUser;
import com.campus.tracking.service.AttendanceService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;

@RestController
@RequestMapping("/api/attendance")
public class AttendanceController {

    @Autowired
    private AttendanceService attendanceService;

    @Autowired
    private AttendanceRecordRepository attendanceRecordRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CurrentUser currentUser;

    // Marking endpoints are admin only (SecurityConfig).
    @PostMapping("/present")
    public ResponseEntity<AttendanceRecord> markPresent(@RequestParam Long userId, @RequestParam String classroomId) {
        requireTarget(userId, classroomId);
        return ResponseEntity.ok(attendanceService.markPresent(userId, classroomId.trim(), currentUser.id()));
    }

    @PostMapping("/bunk")
    public ResponseEntity<AttendanceRecord> markBunked(@RequestParam Long userId, @RequestParam String classroomId) {
        requireTarget(userId, classroomId);
        return ResponseEntity.ok(attendanceService.markBunked(userId, classroomId.trim(), currentUser.id()));
    }

    @GetMapping("/{userId}")
    public ResponseEntity<List<AttendanceRecord>> getHistory(@PathVariable Long userId) {
        currentUser.requireSelfOrAdmin(userId);
        return ResponseEntity.ok(attendanceRecordRepository.findByUserId(userId));
    }

    private void requireTarget(Long userId, String classroomId) {
        if (classroomId == null || classroomId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "classroomId is required");
        }
        if (!userRepository.existsById(userId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found");
        }
    }
}
