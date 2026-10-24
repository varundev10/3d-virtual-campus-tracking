package com.campus.tracking.controller;

import com.campus.tracking.dto.LocationUpdateRequest;
import com.campus.tracking.model.LocationPing;
import com.campus.tracking.repository.LocationPingRepository;
import com.campus.tracking.repository.UserRepository;
import com.campus.tracking.security.CurrentUser;
import com.campus.tracking.service.LocationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
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
    private CurrentUser currentUser;

    @PostMapping
    public ResponseEntity<LocationPing> postLocation(@RequestBody LocationUpdateRequest request) {
        // Regular users can only report their own position. Admins may submit for another user
        // (e.g. BLE/RFID/Wi-Fi infrastructure integrations).
        if (!currentUser.isAdmin() || request.getUserId() == null) {
            request.setUserId(currentUser.id());
        } else if (!userRepository.existsById(request.getUserId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found");
        }
        return ResponseEntity.ok(locationService.recordLocation(request));
    }

    @GetMapping("/{userId}/recent")
    public ResponseEntity<List<LocationPing>> getRecent(@PathVariable Long userId) {
        currentUser.requireSelfOrAdmin(userId);
        return ResponseEntity.ok(locationPingRepository.findTop10ByUserIdOrderByTimestampDesc(userId));
    }
}
