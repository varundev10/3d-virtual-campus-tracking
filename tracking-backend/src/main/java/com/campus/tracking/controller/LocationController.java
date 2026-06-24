package com.campus.tracking.controller;

import com.campus.tracking.dto.LocationUpdateRequest;
import com.campus.tracking.model.LocationPing;
import com.campus.tracking.repository.LocationPingRepository;
import com.campus.tracking.service.LocationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/locations")
public class LocationController {

    @Autowired
    private LocationService locationService;

    @Autowired
    private LocationPingRepository locationPingRepository;

    @PostMapping
    public ResponseEntity<LocationPing> postLocation(@RequestBody LocationUpdateRequest request) {
        return ResponseEntity.ok(locationService.recordLocation(request));
    }

    @GetMapping("/{userId}/recent")
    public ResponseEntity<List<LocationPing>> getRecent(@PathVariable Long userId) {
        return ResponseEntity.ok(locationPingRepository.findTop10ByUserIdOrderByTimestampDesc(userId));
    }
}
