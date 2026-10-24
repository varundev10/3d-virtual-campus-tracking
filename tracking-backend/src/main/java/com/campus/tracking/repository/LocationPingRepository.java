package com.campus.tracking.repository;

import com.campus.tracking.model.LocationPing;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDateTime;
import java.util.List;

public interface LocationPingRepository extends JpaRepository<LocationPing, Long>, JpaSpecificationExecutor<LocationPing> {
    List<LocationPing> findTop10ByUserIdOrderByTimestampDesc(Long userId);

    long countByTimestampAfter(LocalDateTime since);

    @Query("select count(distinct p.userId) from LocationPing p where p.timestamp >= :since")
    long countDistinctUsersSince(@Param("since") LocalDateTime since);

    @Query("""
            select p from LocationPing p
            where p.id in (select max(p2.id) from LocationPing p2 where p2.timestamp >= :since group by p2.userId)
            order by p.timestamp desc
            """)
    List<LocationPing> findLatestPerUserSince(@Param("since") LocalDateTime since);

    @Query("""
            select cast(p.timestamp as LocalDate), count(p) from LocationPing p
            where p.timestamp >= :from and p.timestamp < :to
            group by cast(p.timestamp as LocalDate)
            order by cast(p.timestamp as LocalDate)
            """)
    List<Object[]> countPerDay(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    @Query("""
            select p.source, count(p) from LocationPing p
            where p.timestamp >= :from and p.timestamp < :to
            group by p.source
            """)
    List<Object[]> countBySource(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);
}
