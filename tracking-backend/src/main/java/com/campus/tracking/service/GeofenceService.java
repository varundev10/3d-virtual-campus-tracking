package com.campus.tracking.service;

import org.springframework.stereotype.Service;

/**
 * Server-side campus boundary check. The polygon lives in {@link CampusBoundary} (the UCER perimeter exported
 * from the Metashape boundary KML) and mirrors CAMPUS_GEOFENCE in tracking-frontend/src/lib/campus.js; keep the
 * two in sync.
 */
@Service
public class GeofenceService {

    public boolean isInsideCampus(double latitude, double longitude) {
        return CampusBoundary.contains(latitude, longitude);
    }
}
