package com.campus.tracking.service;

import com.campus.tracking.dto.*;
import com.campus.tracking.model.User;
import com.campus.tracking.repository.UserRepository;
import com.campus.tracking.security.JwtService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import jakarta.annotation.PostConstruct;
import java.util.Locale;
import java.util.UUID;

@Service
public class UserAccountService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtService jwtService;

    // Compared against when the email is unknown so response time does not reveal registered emails.
    private String dummyHash;

    @PostConstruct
    void initDummyHash() {
        dummyHash = passwordEncoder.encode(UUID.randomUUID().toString());
    }

    public static String normalizeEmail(String email) {
        return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
    }

    /** Public self-registration always creates a STUDENT; elevated roles are granted only by an admin. */
    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String email = normalizeEmail(request.getEmail());
        if (userRepository.findByEmailIgnoreCase(email).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "An account with this email already exists");
        }
        User user = new User();
        user.setName(request.getName().trim());
        user.setEmail(email);
        user.setRole(User.Role.STUDENT);
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user = userRepository.save(user);
        return toAuthResponse(user);
    }

    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmailIgnoreCase(normalizeEmail(request.getEmail())).orElse(null);
        if (user == null || !user.getHasPassword()) {
            passwordEncoder.matches(request.getPassword(), dummyHash);
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
        }
        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
        }
        if (!user.getActive()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This account has been deactivated. Contact campus administration.");
        }
        return toAuthResponse(user);
    }

    private AuthResponse toAuthResponse(User user) {
        JwtService.IssuedToken token = jwtService.issue(user);
        return new AuthResponse(token.token(), token.expiresAt(), user);
    }

    public User require(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }

    @Transactional
    public User updateProfile(Long userId, UpdateProfileRequest request) {
        User user = require(userId);
        user.setName(request.getName().trim());
        return userRepository.save(user);
    }

    @Transactional
    public void changeOwnPassword(Long userId, ChangePasswordRequest request) {
        User user = require(userId);
        if (!user.getHasPassword() || !passwordEncoder.matches(request.getCurrentPassword(), user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Current password is incorrect");
        }
        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
    }

    @Transactional
    public User create(CreateUserRequest request) {
        String email = normalizeEmail(request.getEmail());
        if (userRepository.findByEmailIgnoreCase(email).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "An account with this email already exists");
        }
        User user = new User();
        user.setName(request.getName().trim());
        user.setEmail(email);
        user.setRole(request.getRole());
        if (request.getPassword() != null && !request.getPassword().isBlank()) {
            user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        }
        return userRepository.save(user);
    }

    @Transactional
    public User update(Long actingAdminId, Long userId, UpdateUserRequest request) {
        User user = require(userId);
        boolean self = user.getId().equals(actingAdminId);
        boolean losesAdmin = user.getRole() == User.Role.ADMIN && user.getActive()
                && ((request.getRole() != null && request.getRole() != User.Role.ADMIN)
                || Boolean.FALSE.equals(request.getActive()));

        if (self && losesAdmin) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "You cannot remove your own admin access or deactivate your own account");
        }
        if (losesAdmin && userRepository.countActiveAdmins() <= 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "At least one active admin must remain");
        }

        if (request.getName() != null) user.setName(request.getName().trim());
        if (request.getRole() != null) user.setRole(request.getRole());
        if (request.getActive() != null) user.setActive(request.getActive());
        return userRepository.save(user);
    }

    @Transactional
    public void setPassword(Long userId, SetPasswordRequest request) {
        User user = require(userId);
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        userRepository.save(user);
    }
}
