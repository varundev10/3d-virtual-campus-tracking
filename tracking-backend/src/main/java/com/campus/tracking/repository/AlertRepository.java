package com.campus.tracking.repository;

import com.campus.tracking.model.Alert;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDateTime;
import java.util.List;

public interface AlertRepository extends JpaRepository<Alert, Long>, JpaSpecificationExecutor<Alert> {

    @Query("""
            select a.type, count(a) from Alert a
            where a.createdAt >= :from and a.createdAt < :to
            group by a.type
            """)
    List<Object[]> countByTypeBetween(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    boolean existsByUserIdAndTypeAndCreatedAtAfter(Long userId, Alert.AlertType type, LocalDateTime since);

    @Query("select count(a) from Alert a where a.acknowledged is null or a.acknowledged = false")
    long countOpen();
}
