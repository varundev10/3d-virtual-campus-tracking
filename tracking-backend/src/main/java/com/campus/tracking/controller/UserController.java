package com.campus.tracking.controller;

import com.campus.tracking.dto.CreateUserRequest;
import com.campus.tracking.model.User;
import com.campus.tracking.repository.UserRepository;
import com.campus.tracking.security.AccessGuard;
import com.campus.tracking.security.AppUserPrincipal;
import com.campus.tracking.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/users")
public class UserController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserService userService;

    @Autowired
    private AccessGuard accessGuard;

    @GetMapping("/me")
    public ResponseEntity<User> getMe(@AuthenticationPrincipal AppUserPrincipal principal) {
        return ResponseEntity.ok(principal.getUser());
    }

    // HOD/Teacher get their department roster; a Student only ever sees themself.
    @GetMapping
    public ResponseEntity<List<User>> getAllUsers(@AuthenticationPrincipal AppUserPrincipal principal) {
        if (principal.getRole() == User.Role.STUDENT) {
            return ResponseEntity.ok(List.of(principal.getUser()));
        }

        Long departmentId = principal.getDepartmentId();
        List<User> users = userRepository.findAll().stream()
                .filter(u -> u.getDepartment() != null && u.getDepartment().getId().equals(departmentId))
                .collect(Collectors.toList());
        return ResponseEntity.ok(users);
    }

    @GetMapping("/{id}")
    public ResponseEntity<User> getUser(@PathVariable Long id, @AuthenticationPrincipal AppUserPrincipal principal) {
        return userRepository.findById(id)
                .filter(target -> accessGuard.canView(principal, target))
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.status(HttpStatus.FORBIDDEN).build());
    }

    // HOD-only: add a Student/Teacher into their own department.
    @PostMapping
    public ResponseEntity<User> createUser(
            @RequestBody CreateUserRequest request,
            @AuthenticationPrincipal AppUserPrincipal principal) {

        if (!accessGuard.canManageMembers(principal)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        User created = userService.createDepartmentMember(request, principal.getRole(), principal.getUser().getDepartment());
        return ResponseEntity.ok(created);
    }
}
