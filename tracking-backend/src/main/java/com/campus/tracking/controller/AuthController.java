package com.campus.tracking.controller;

import com.campus.tracking.dto.*;
import com.campus.tracking.model.User;
import com.campus.tracking.security.CurrentUser;
import com.campus.tracking.service.UserAccountService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired
    private UserAccountService userAccountService;

    @Autowired
    private CurrentUser currentUser;

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(userAccountService.register(request));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(userAccountService.login(request));
    }

    /** The caller's identity and role as currently stored in the database. */
    @GetMapping("/me")
    public ResponseEntity<User> me() {
        return ResponseEntity.ok(userAccountService.require(currentUser.id()));
    }

    @PatchMapping("/me")
    public ResponseEntity<User> updateMe(@Valid @RequestBody UpdateProfileRequest request) {
        return ResponseEntity.ok(userAccountService.updateProfile(currentUser.id(), request));
    }

    @PutMapping("/password")
    public ResponseEntity<Void> changePassword(@Valid @RequestBody ChangePasswordRequest request) {
        userAccountService.changeOwnPassword(currentUser.id(), request);
        return ResponseEntity.noContent().build();
    }
}
