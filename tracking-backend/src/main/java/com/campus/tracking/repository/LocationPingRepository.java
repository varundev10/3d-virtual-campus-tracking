package com.campus.tracking.repository;

import com.campus.tracking.model.LocationPing;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface LocationPingRepository extends JpaRepository<LocationPing, Long>, JpaSpecificationExecutor<LocationPing> {
    List<LocationPing> findTop10ByUserIdOrderByTimestampDesc(Long userId);

    long countByTimestampAfter(LocalDateTime since);

    // The ping the user sent just before the given one; used for movement checks.
    Optional<LocationPing> findFirstByUserIdAndIdLessThanOrderByIdDesc(Long userId, Long id);

    // Positioned pings (GPS) the user sent within a window; stored pings are always inside the geofence.
    @Query("""
            select p from LocationPing p
            where p.userId = :userId and p.timestamp >= :from and p.timestamp <= :to and p.latitude is not null
            order by p.timestamp
            """)
    List<LocationPing> findPositionedBetween(@Param("userId") Long userId,
                                             @Param("from") LocalDateTime from,
                                             @Param("to") LocalDateTime to);

    boolean existsByUserIdAndLatitudeNotNullAndTimestampBetween(Long userId, LocalDateTime from, LocalDateTime to);

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

    // Distinct people seen on campus in each hour of a window (footfall).
    @Query("""
            select extract(hour from p.timestamp), count(distinct p.userId) from LocationPing p
            where p.timestamp >= :from and p.timestamp < :to
            group by extract(hour from p.timestamp)
            order by extract(hour from p.timestamp)
            """)
    List<Object[]> countDistinctUsersPerHour(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);
}
