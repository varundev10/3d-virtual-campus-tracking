package com.campus.tracking.controller;

import com.campus.tracking.model.Alert;
import com.campus.tracking.model.User;
import com.campus.tracking.repository.AlertRepository;
import com.campus.tracking.repository.UserRepository;
import com.campus.tracking.security.AppUserPrincipal;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/alerts")
public class AlertController {

    @Autowired
    private AlertRepository alertRepository;

    @Autowired
    private UserRepository userRepository;

    // Same department-wide visibility rule as everything else: a Student only sees alerts
    // raised against them, a Teacher/HOD see every alert for their department's members.
    @GetMapping
    public ResponseEntity<List<Alert>> getAlerts(@AuthenticationPrincipal AppUserPrincipal principal) {
        if (principal.getRole() == User.Role.STUDENT) {
            List<Alert> ownAlerts = alertRepository.findAll().stream()
                    .filter(alert -> alert.getUserId().equals(principal.getUserId()))
                    .sorted(Comparator.comparing(Alert::getCreatedAt).reversed())
                    .collect(Collectors.toList());
            return ResponseEntity.ok(ownAlerts);
        }

        Long departmentId = principal.getDepartmentId();
        Map<Long, Long> userDepartments = userRepository.findAll().stream()
                .filter(u -> u.getDepartment() != null)
                .collect(Collectors.toMap(User::getId, u -> u.getDepartment().getId()));

        List<Alert> scoped = alertRepository.findAll().stream()
                .filter(alert -> departmentId.equals(userDepartments.get(alert.getUserId())))
                .sorted(Comparator.comparing(Alert::getCreatedAt).reversed())
                .collect(Collectors.toList());

        return ResponseEntity.ok(scoped);
    }
}
