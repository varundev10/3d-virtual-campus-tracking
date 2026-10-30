package com.campus.tracking.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "attendance_records",
        uniqueConstraints = @UniqueConstraint(name = "uq_attendance_session_day",
                columnNames = {"userId", "sessionId", "sessionDate"}))
@Data
public class AttendanceRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    // The classroom code. Kept as text so records written before classrooms existed stay valid.
    @Column(nullable = false)
    private String classroomId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status;

    @Column(nullable = false)
    private LocalDateTime checkTime = LocalDateTime.now();

    // Set for records tied to a timetable slot; null for ad-hoc admin marks and legacy rows.
    private Long sessionId;
    private LocalDate sessionDate;

    // How the record came about. Null on legacy rows, which were all marked by hand.
    @Enumerated(EnumType.STRING)
    @Column(length = 12)
    private Method method;

    // Who made a manual mark or override.
    private Long markedBy;

    @Column(length = 255)
    private String note;

    public enum Status {
        PRESENT, ABSENT, BUNKED
    }

    public enum Method {
        AUTO, MANUAL
    }
}
