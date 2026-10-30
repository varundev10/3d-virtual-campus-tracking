package com.campus.tracking.model;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

/** Marks that a session on a given date has been finalized, so absentees are only processed once. */
@Entity
@Table(name = "session_outcomes",
        uniqueConstraints = @UniqueConstraint(name = "uq_session_outcome", columnNames = {"sessionId", "sessionDate"}))
@Data
public class SessionOutcome {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long sessionId;

    @Column(nullable = false)
    private LocalDate sessionDate;

    @Column(nullable = false)
    private LocalDateTime finalizedAt;

    private int present;
    private int absent;
    private int bunked;
}
