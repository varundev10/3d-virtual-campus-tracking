package com.campus.tracking.repository;

import com.campus.tracking.model.LocationPing;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface LocationPingRepository extends JpaRepository<LocationPing, Long> {
    List<LocationPing> findTop10ByUserIdOrderByTimestampDesc(Long userId);
}
