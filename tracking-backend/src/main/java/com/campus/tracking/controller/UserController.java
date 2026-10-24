package com.campus.tracking.controller;

import com.campus.tracking.dto.CreateUserRequest;
import com.campus.tracking.dto.SetPasswordRequest;
import com.campus.tracking.dto.UpdateUserRequest;
import com.campus.tracking.model.User;
import com.campus.tracking.repository.UserRepository;
import com.campus.tracking.security.CurrentUser;
import com.campus.tracking.service.UserAccountService;
import jakarta.persistence.criteria.Predicate;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@RestController
@RequestMapping("/api/users")
public class UserController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserAccountService userAccountService;

    @Autowired
    private CurrentUser currentUser;

    // Admin only (SecurityConfig). Same body as before plus an optional initial password.
    @PostMapping
    public ResponseEntity<User> createUser(@Valid @RequestBody CreateUserRequest request) {
        return ResponseEntity.ok(userAccountService.create(request));
    }

    // Admin only. Filters are optional; with none, all users are returned as before.
    @GetMapping
    public ResponseEntity<List<User>> getAllUsers(@RequestParam(required = false) String q,
                                                  @RequestParam(required = false) User.Role role,
                                                  @RequestParam(required = false) Boolean active) {
        Specification<User> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (q != null && !q.isBlank()) {
                String like = "%" + q.trim().toLowerCase(Locale.ROOT) + "%";
                predicates.add(cb.or(cb.like(cb.lower(root.get("name")), like),
                        cb.like(cb.lower(root.get("email")), like)));
            }
            if (role != null) predicates.add(cb.equal(root.get("role"), role));
            if (Boolean.TRUE.equals(active)) {
                predicates.add(cb.or(cb.isNull(root.get("active")), cb.isTrue(root.get("active"))));
            } else if (Boolean.FALSE.equals(active)) {
                predicates.add(cb.isFalse(root.get("active")));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
        return ResponseEntity.ok(userRepository.findAll(spec, Sort.by("id")));
    }

    @GetMapping("/{id}")
    public ResponseEntity<User> getUser(@PathVariable Long id) {
        currentUser.requireSelfOrAdmin(id);
        return userRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // Admin only: change name, role or active status.
    @PatchMapping("/{id}")
    public ResponseEntity<User> updateUser(@PathVariable Long id, @Valid @RequestBody UpdateUserRequest request) {
        return ResponseEntity.ok(userAccountService.update(currentUser.id(), id, request));
    }

    // Admin only: set or reset a user's password.
    @PutMapping("/{id}/password")
    public ResponseEntity<Void> setPassword(@PathVariable Long id, @Valid @RequestBody SetPasswordRequest request) {
        userAccountService.setPassword(id, request);
        return ResponseEntity.noContent().build();
    }
}
