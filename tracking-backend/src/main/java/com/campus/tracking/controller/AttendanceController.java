package com.campus.tracking.controller;

import com.campus.tracking.model.AttendanceRecord;
import com.campus.tracking.model.Classroom;
import com.campus.tracking.model.User;
import com.campus.tracking.repository.AttendanceRecordRepository;
import com.campus.tracking.repository.ClassroomRepository;
import com.campus.tracking.repository.UserRepository;
import com.campus.tracking.security.AccessGuard;
import com.campus.tracking.security.AppUserPrincipal;
import com.campus.tracking.service.AttendanceService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/attendance")
public class AttendanceController {

    @Autowired
    private AttendanceService attendanceService;

    @Autowired
    private AttendanceRecordRepository attendanceRecordRepository;

    @Autowired
    private ClassroomRepository classroomRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private AccessGuard accessGuard;

    // A student can only mark themselves; a teacher can only mark for a classroom they teach.
    private boolean canMark(AppUserPrincipal principal, Long userId, String classroomCode) {
        if (accessGuard.isSelf(principal, userId)) return true;

        if (principal.getRole() == User.Role.TEACHER) {
            Classroom classroom = classroomRepository.findByCode(classroomCode).orElse(null);
            return classroom != null && accessGuard.teachesClassroom(principal, classroom);
        }

        return false;
    }

    @PostMapping("/present")
    public ResponseEntity<AttendanceRecord> markPresent(
            @RequestParam Long userId,
            @RequestParam String classroomId,
            @AuthenticationPrincipal AppUserPrincipal principal) {

        if (!canMark(principal, userId, classroomId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        return ResponseEntity.ok(attendanceService.markPresent(userId, classroomId));
    }

    @PostMapping("/bunk")
    public ResponseEntity<AttendanceRecord> markBunked(
            @RequestParam Long userId,
            @RequestParam String classroomId,
            @AuthenticationPrincipal AppUserPrincipal principal) {

        if (!canMark(principal, userId, classroomId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        return ResponseEntity.ok(attendanceService.markBunked(userId, classroomId));
    }

    @GetMapping("/{userId}")
    public ResponseEntity<List<AttendanceRecord>> getHistory(
            @PathVariable Long userId,
            @AuthenticationPrincipal AppUserPrincipal principal) {

        User target = userRepository.findById(userId).orElse(null);
        if (target == null || !accessGuard.canView(principal, target)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        return ResponseEntity.ok(attendanceRecordRepository.findByUserId(userId));
    }
}
