package com.campus.tracking.service;

import com.campus.tracking.dto.LocationUpdateRequest;
import com.campus.tracking.model.LocationPing;
import com.campus.tracking.repository.LocationPingRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@Service
public class LocationService {

    @Autowired
    private LocationPingRepository locationPingRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    public LocationPing recordLocation(LocationUpdateRequest request) {
        if (request.getLatitude() == null || request.getLongitude() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Latitude and longitude are required");
        }
        if (!CampusBoundary.contains(request.getLatitude(), request.getLongitude())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Location is outside the campus boundary");
        }

        LocationPing ping = new LocationPing();
        ping.setUserId(request.getUserId());
        ping.setLatitude(request.getLatitude());
        ping.setLongitude(request.getLongitude());
        ping.setFloorLevel(request.getFloorLevel() == null ? 0 : request.getFloorLevel());
        ping.setBeaconId(request.getBeaconId());
        ping.setWifiPointId(request.getWifiPointId());
        ping.setRfidTagId(request.getRfidTagId());
        if (request.getSource() != null) {
            ping.setSource(LocationPing.SourceType.valueOf(request.getSource()));
        }

        LocationPing saved = locationPingRepository.save(ping);

        messagingTemplate.convertAndSend("/topic/locations", saved);

        return saved;
    }
}
