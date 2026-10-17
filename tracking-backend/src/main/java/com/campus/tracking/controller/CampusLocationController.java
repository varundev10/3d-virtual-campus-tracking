package com.campus.tracking.controller;

import com.campus.tracking.dto.CampusLocationRequest;
import com.campus.tracking.model.CampusLocation;
import com.campus.tracking.repository.CampusLocationRepository;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;

// Readable by every signed-in user; writes are admin only (SecurityConfig).
@RestController
@RequestMapping("/api/campus-locations")
public class CampusLocationController {

    @Autowired
    private CampusLocationRepository campusLocationRepository;

    @GetMapping
    public ResponseEntity<List<CampusLocation>> list() {
        return ResponseEntity.ok(campusLocationRepository.findAllByOrderByNameAsc());
    }

    @GetMapping("/{id}")
    public ResponseEntity<CampusLocation> get(@PathVariable Long id) {
        return ResponseEntity.ok(require(id));
    }

    @PostMapping
    public ResponseEntity<CampusLocation> create(@Valid @RequestBody CampusLocationRequest request) {
        if (campusLocationRepository.findByCodeIgnoreCase(request.getCode()).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "A location with code " + request.getCode() + " already exists");
        }
        CampusLocation location = new CampusLocation();
        location.setCode(request.getCode());
        apply(location, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(campusLocationRepository.save(location));
    }

    @PutMapping("/{id}")
    public ResponseEntity<CampusLocation> update(@PathVariable Long id, @Valid @RequestBody CampusLocationRequest request) {
        CampusLocation location = require(id);
        if (!location.getCode().equalsIgnoreCase(request.getCode())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Location codes cannot be changed because 3D scene labels and records reference them");
        }
        apply(location, request);
        return ResponseEntity.ok(campusLocationRepository.save(location));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        campusLocationRepository.delete(require(id));
        return ResponseEntity.noContent().build();
    }

    private CampusLocation require(Long id) {
        return campusLocationRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Campus location not found"));
    }

    private static void apply(CampusLocation location, CampusLocationRequest request) {
        location.setName(request.getName().trim());
        location.setCategory(request.getCategory());
        String description = request.getDescription();
        location.setDescription(description == null || description.isBlank() ? null : description.trim());
        location.setLatitude(request.getLatitude());
        location.setLongitude(request.getLongitude());
    }
}
