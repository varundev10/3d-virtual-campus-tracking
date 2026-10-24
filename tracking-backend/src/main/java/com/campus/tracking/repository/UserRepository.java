package com.campus.tracking.repository;

import com.campus.tracking.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long>, JpaSpecificationExecutor<User> {
    Optional<User> findByEmailIgnoreCase(String email);

    @Query("select count(u) from User u where u.role = com.campus.tracking.model.User.Role.ADMIN and (u.active is null or u.active = true)")
    long countActiveAdmins();

    @Query("select u.role, count(u) from User u group by u.role")
    List<Object[]> countByRole();

    @Query("select count(u) from User u where u.active = false")
    long countInactive();
}
