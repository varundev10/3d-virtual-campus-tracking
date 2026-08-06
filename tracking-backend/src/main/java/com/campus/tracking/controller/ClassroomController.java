package com.campus.tracking.controller;

import com.campus.tracking.model.Classroom;
import com.campus.tracking.model.User;
import com.campus.tracking.repository.ClassroomRepository;
import com.campus.tracking.security.AppUserPrincipal;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/classrooms")
public class ClassroomController {

    @Autowired
    private ClassroomRepository classroomRepository;

    // Teachers only see classrooms they're assigned to; Students/HOD see the whole department
    // (a student needs to know which classroom codes exist to mark GPS-based attendance against).
    @GetMapping
    public ResponseEntity<List<Classroom>> getClassrooms(@AuthenticationPrincipal AppUserPrincipal principal) {
        if (principal.getRole() == User.Role.TEACHER) {
            return ResponseEntity.ok(classroomRepository.findByTeachers_Id(principal.getUserId()));
        }

        Long departmentId = principal.getDepartmentId();
        return ResponseEntity.ok(classroomRepository.findByDepartmentId(departmentId));
    }
}
