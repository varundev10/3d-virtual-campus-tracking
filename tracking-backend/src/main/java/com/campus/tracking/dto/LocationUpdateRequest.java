package com.campus.tracking.dto;

import lombok.Data;

@Data
public class LocationUpdateRequest {
    private Long userId;
    private Double latitude;
    private Double longitude;
    private String beaconId;
    private String wifiPointId;
    private String rfidTagId;
    private String source;
}
