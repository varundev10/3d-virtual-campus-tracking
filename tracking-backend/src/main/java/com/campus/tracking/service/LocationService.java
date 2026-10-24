package com.campus.tracking.service;

import com.campus.tracking.dto.LocationUpdateRequest;
import com.campus.tracking.model.LocationPing;
import com.campus.tracking.repository.LocationPingRepository;
import com.campus.tracking.security.StompAuthChannelInterceptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.Locale;

@Service
public class LocationService {

    @Autowired
    private LocationPingRepository locationPingRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    private GeofenceService geofenceService;

    public LocationPing recordLocation(LocationUpdateRequest request) {
        LocationPing.SourceType source = parseSource(request.getSource());
        Double latitude = request.getLatitude();
        Double longitude = request.getLongitude();

        if ((latitude == null) != (longitude == null)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Latitude and longitude must be sent together");
        }
        if (source == LocationPing.SourceType.GPS && latitude == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "GPS pings require latitude and longitude");
        }
        if (latitude != null) {
            if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Coordinates are out of range");
            }
            // Geofence-first privacy rule: positions outside campus are never stored or broadcast.
            if (!geofenceService.isInsideCampus(latitude, longitude)) {
                throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_CONTENT,
                        "Position is outside the campus geofence and was not stored");
            }
        }

        LocationPing ping = new LocationPing();
        ping.setUserId(request.getUserId());
        ping.setLatitude(latitude);
        ping.setLongitude(longitude);
        ping.setFloorLevel(request.getFloorLevel() == null ? 0 : request.getFloorLevel());
        ping.setBeaconId(request.getBeaconId());
        ping.setWifiPointId(request.getWifiPointId());
        ping.setRfidTagId(request.getRfidTagId());
        ping.setSource(source);

        LocationPing saved = locationPingRepository.save(ping);

        messagingTemplate.convertAndSend(StompAuthChannelInterceptor.LOCATIONS_TOPIC, saved);

        return saved;
    }

    private static LocationPing.SourceType parseSource(String source) {
        if (source == null || source.isBlank()) return LocationPing.SourceType.GPS;
        try {
            return LocationPing.SourceType.valueOf(source.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Unknown source '" + source + "'. Use GPS, BLE, WIFI or RFID");
        }
    }
}
