package com.campus.tracking.model;

import jakarta.persistence.*;
import lombok.Data;

import java.time.DayOfWeek;
import java.time.LocalDateTime;
import java.time.LocalTime;

/** One recurring slot of the weekly timetable: a subject taught in a classroom to a department. */
@Entity
@Table(name = "class_sessions")
@Data
public class ClassSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 120)
    private String subject;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "classroom_id", nullable = false)
    private Classroom classroom;

    // The students expected in this session are the active students of this department.
    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "department_id", nullable = false)
    private Department department;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "faculty_id")
    private User faculty;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private DayOfWeek dayOfWeek;

    @Column(nullable = false)
    private LocalTime startTime;

    @Column(nullable = false)
    private LocalTime endTime;

    private Boolean active = true;

    // Campus-local time of the last create/edit. A slot changed after it began is not finalized for that day,
    // so adding a past class late in the day cannot mark everyone absent.
    private LocalDateTime updatedAt;

    public boolean isActiveSlot() {
        return !Boolean.FALSE.equals(active);
    }
}
