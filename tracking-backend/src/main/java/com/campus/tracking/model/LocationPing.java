package com.campus.tracking.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "location_pings")
@Data
public class LocationPing {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    private Double latitude;
    private Double longitude;

    private String beaconId;
    private String wifiPointId;
    private String rfidTagId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SourceType source;

    @Column(nullable = false)
    private LocalDateTime timestamp = LocalDateTime.now();

    public enum SourceType {
        GPS, BLE, WIFI, RFID
    }
}
