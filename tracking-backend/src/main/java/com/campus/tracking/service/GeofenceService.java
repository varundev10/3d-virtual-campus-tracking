package com.campus.tracking.service;

import org.springframework.stereotype.Service;

/**
 * Server-side campus boundary check (point-in-polygon). The polygon mirrors
 * CAMPUS_GEOFENCE in tracking-frontend/src/lib/campus.js; keep the two in sync.
 */
@Service
public class GeofenceService {

    // [latitude, longitude]
    private static final double[][] CAMPUS_GEOFENCE = {
            {25.43145, 81.76895},
            {25.43205, 81.7708},
            {25.43095, 81.77225},
            {25.42945, 81.77185},
            {25.42895, 81.76985},
            {25.43005, 81.7687},
    };

    public boolean isInsideCampus(double latitude, double longitude) {
        boolean inside = false;
        for (int i = 0, j = CAMPUS_GEOFENCE.length - 1; i < CAMPUS_GEOFENCE.length; j = i++) {
            double yi = CAMPUS_GEOFENCE[i][0], xi = CAMPUS_GEOFENCE[i][1];
            double yj = CAMPUS_GEOFENCE[j][0], xj = CAMPUS_GEOFENCE[j][1];
            boolean intersects = (yi > latitude) != (yj > latitude)
                    && longitude < (xj - xi) * (latitude - yi) / (yj - yi) + xi;
            if (intersects) inside = !inside;
        }
        return inside;
    }
}
