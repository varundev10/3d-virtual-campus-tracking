package com.campus.tracking.controller;

import com.campus.tracking.dto.PageResponse;
import com.campus.tracking.model.Alert;
import com.campus.tracking.model.User;
import com.campus.tracking.repository.AlertRepository;
import com.campus.tracking.repository.UserRepository;
import com.campus.tracking.security.AccessScope;
import jakarta.persistence.criteria.Predicate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

// Alerts for the caller's scope: everyone's for an admin, a department's for its faculty, one's own for a student.
@RestController
@RequestMapping("/api/alerts")
public class AlertController {

    private static final int MAX_PAGE_SIZE = 100;

    public record AlertView(Long id, Long userId, String userName, Alert.AlertType type, String message,
                            LocalDateTime createdAt, boolean acknowledged, LocalDateTime acknowledgedAt) {
    }

    @Autowired
    private AlertRepository alertRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private AccessScope scope;

    @Autowired
    private Clock clock;

    /** Alerts about the given users (all users when {@code visibleUserIds} is null). */
    public static Specification<Alert> spec(Set<Long> visibleUserIds, Boolean acknowledged, Alert.AlertType type) {
        return (root, query, cb) -> {
            List<Predicate> p = new ArrayList<>();
            if (visibleUserIds != null) p.add(root.get("userId").in(visibleUserIds));
            if (type != null) p.add(cb.equal(root.get("type"), type));
            if (Boolean.TRUE.equals(acknowledged)) {
                p.add(cb.isTrue(root.get("acknowledged")));
            } else if (Boolean.FALSE.equals(acknowledged)) {
                p.add(cb.or(cb.isNull(root.get("acknowledged")), cb.isFalse(root.get("acknowledged"))));
            }
            return cb.and(p.toArray(new Predicate[0]));
        };
    }

    @GetMapping
    public PageResponse<AlertView> list(@RequestParam(required = false) Boolean acknowledged,
                                        @RequestParam(required = false) Alert.AlertType type,
                                        @RequestParam(defaultValue = "0") int page,
                                        @RequestParam(defaultValue = "20") int size) {
        User caller = scope.caller();
        var result = alertRepository.findAll(spec(scope.visibleUserIds(caller), acknowledged, type),
                PageRequest.of(Math.max(0, page), Math.max(1, Math.min(size, MAX_PAGE_SIZE)),
                        Sort.by(Sort.Direction.DESC, "createdAt")));

        Map<Long, String> names = userRepository.findAllById(
                        result.getContent().stream().map(Alert::getUserId).collect(Collectors.toSet()))
                .stream().collect(Collectors.toMap(User::getId, User::getName, (a, b) -> a));
        return PageResponse.of(result.map(a -> view(a, names.getOrDefault(a.getUserId(), "User " + a.getUserId()))));
    }

    // Staff only (SecurityConfig); the alert must be about someone the caller may see.
    @PostMapping("/{id}/acknowledge")
    public AlertView acknowledge(@PathVariable Long id) {
        User caller = scope.caller();
        Alert alert = alertRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Alert not found"));
        if (!scope.canSee(caller, alert.getUserId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot act on this alert");
        }
        if (!alert.getAcknowledged()) {
            alert.setAcknowledged(true);
            alert.setAcknowledgedAt(LocalDateTime.now(clock));
            alert.setAcknowledgedBy(caller.getId());
            alert = alertRepository.save(alert);
        }
        String name = userRepository.findById(alert.getUserId()).map(User::getName).orElse("User " + alert.getUserId());
        return view(alert, name);
    }

    private static AlertView view(Alert a, String userName) {
        return new AlertView(a.getId(), a.getUserId(), userName, a.getType(), a.getMessage(), a.getCreatedAt(),
                a.getAcknowledged(), a.getAcknowledgedAt());
    }
}
