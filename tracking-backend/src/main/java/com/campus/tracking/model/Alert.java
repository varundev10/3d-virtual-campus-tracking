package com.campus.tracking.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "alerts")
@Data
public class Alert {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // The user the alert is about (the student who bunked, the faculty member who was off schedule, ...).
    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false)
    private String message;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AlertType type;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    // Null on rows created before acknowledgement existed; read through isAcknowledged().
    private Boolean acknowledged;
    private LocalDateTime acknowledgedAt;
    private Long acknowledgedBy;

    public boolean getAcknowledged() {
        return Boolean.TRUE.equals(acknowledged);
    }

    public enum AlertType {
        BUNK_DETECTED, FACULTY_OFF_SCHEDULE, UNUSUAL_MOVEMENT
    }
}
