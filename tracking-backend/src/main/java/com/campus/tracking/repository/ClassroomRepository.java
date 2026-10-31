package com.campus.tracking.repository;

import com.campus.tracking.model.Classroom;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface ClassroomRepository extends JpaRepository<Classroom, Long> {
    Optional<Classroom> findByCodeIgnoreCase(String code);

    List<Classroom> findAllByOrderByCodeAsc();
}
