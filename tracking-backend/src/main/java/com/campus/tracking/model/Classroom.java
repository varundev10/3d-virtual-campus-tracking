package com.campus.tracking.model;

import jakarta.persistence.*;
import lombok.Data;

/**
 * A room attendance is verified against. A student counts as being in the room when a GPS ping falls within
 * {@code radiusMeters} of its coordinates (and on its floor, when one is set).
 */
@Entity
@Table(name = "classrooms")
@Data
public class Classroom {

    public static final int DEFAULT_RADIUS_METERS = 25;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Stable identifier shown in attendance records (e.g. "A-204").
    @Column(nullable = false, unique = true, length = 32)
    private String code;

    @Column(nullable = false, length = 120)
    private String name;

    // Optional link to the campus location (building) this room is in; coordinates default to it.
    @Column(length = 32)
    private String locationCode;

    @Column(nullable = false)
    private Double latitude;

    @Column(nullable = false)
    private Double longitude;

    @Column(nullable = false)
    private Integer radiusMeters = DEFAULT_RADIUS_METERS;

    // Ground floor is 0. Null means pings from any floor count.
    private Integer floorLevel;

    private Integer capacity;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "department_id")
    private Department department;
}
