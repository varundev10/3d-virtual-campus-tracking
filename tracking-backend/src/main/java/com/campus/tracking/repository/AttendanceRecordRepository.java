package com.campus.tracking.repository;

import com.campus.tracking.model.AttendanceRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDateTime;
import java.util.List;

public interface AttendanceRecordRepository extends JpaRepository<AttendanceRecord, Long>, JpaSpecificationExecutor<AttendanceRecord> {
    List<AttendanceRecord> findByUserId(Long userId);

    @Query("select a.status, count(a) from AttendanceRecord a group by a.status")
    List<Object[]> countByStatus();

    @Query("""
            select a.status, count(a) from AttendanceRecord a
            where a.checkTime >= :from and a.checkTime < :to
            group by a.status
            """)
    List<Object[]> countByStatusBetween(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);
}
