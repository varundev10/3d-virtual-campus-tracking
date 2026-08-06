package com.campus.tracking.repository;

import com.campus.tracking.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);

    // Used to build the security principal: department must be loaded eagerly here because
    // this query runs inside the JWT filter, before the request's Hibernate session opens -
    // a lazy `department` proxy on this entity would never be resolvable later (e.g. when
    // serializing /api/users/me), since by then the short-lived session it belongs to is gone.
    @Query("select u from User u left join fetch u.department where u.email = :email")
    Optional<User> findByEmailWithDepartment(String email);
}
