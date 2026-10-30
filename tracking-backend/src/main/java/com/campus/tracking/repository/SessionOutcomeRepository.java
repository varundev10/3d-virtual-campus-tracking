package com.campus.tracking.repository;

import com.campus.tracking.model.SessionOutcome;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;

public interface SessionOutcomeRepository extends JpaRepository<SessionOutcome, Long> {
    boolean existsBySessionIdAndSessionDate(Long sessionId, LocalDate sessionDate);
}
