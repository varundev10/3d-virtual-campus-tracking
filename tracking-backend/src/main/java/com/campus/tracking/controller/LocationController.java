package com.campus.tracking.controller;

import com.campus.tracking.dto.LocationUpdateRequest;
import com.campus.tracking.model.LocationPing;
import com.campus.tracking.model.User;
import com.campus.tracking.repository.LocationPingRepository;
import com.campus.tracking.repository.UserRepository;
import com.campus.tracking.security.AccessGuard;
import com.campus.tracking.security.AppUserPrincipal;
import com.campus.tracking.service.LocationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/locations")
public class LocationController {

    @Autowired
    private LocationService locationService;

    @Autowired
    private LocationPingRepository locationPingRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private AccessGuard accessGuard;

    // Every role tracks and reports its own GPS; nobody can post a ping on someone else's behalf.
    @PostMapping
    public ResponseEntity<LocationPing> postLocation(
            @RequestBody LocationUpdateRequest request,
            @AuthenticationPrincipal AppUserPrincipal principal) {

        if (!accessGuard.isSelf(principal, request.getUserId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        return ResponseEntity.ok(locationService.recordLocation(request));
    }

    @GetMapping("/{userId}/recent")
    public ResponseEntity<List<LocationPing>> getRecent(
            @PathVariable Long userId,
            @AuthenticationPrincipal AppUserPrincipal principal) {

        User target = userRepository.findById(userId).orElse(null);
        if (target == null || !accessGuard.canView(principal, target)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        return ResponseEntity.ok(locationPingRepository.findTop10ByUserIdOrderByTimestampDesc(userId));
    }
}
