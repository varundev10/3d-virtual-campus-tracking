package com.campus.tracking.repository;

import com.campus.tracking.model.CampusLocation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;
import java.util.Optional;

public interface CampusLocationRepository extends JpaRepository<CampusLocation, Long> {
    Optional<CampusLocation> findByCodeIgnoreCase(String code);

    List<CampusLocation> findAllByOrderByNameAsc();

    @Query("select l.category, count(l) from CampusLocation l group by l.category")
    List<Object[]> countByCategory();
}
