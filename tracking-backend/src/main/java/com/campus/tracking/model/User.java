package com.campus.tracking.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Data
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, unique = true)
    private String email;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    // BCrypt hash. Nullable so rows created before authentication existed stay valid;
    // such users cannot sign in until an admin sets a password for them.
    @JsonIgnore
    private String passwordHash;

    // Nullable for the same reason; a missing value is treated as active.
    private Boolean active = true;

    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (active == null) active = true;
    }

    public Boolean getActive() {
        return !Boolean.FALSE.equals(active);
    }

    public boolean getHasPassword() {
        return passwordHash != null && !passwordHash.isBlank();
    }

    public enum Role {
        STUDENT, FACULTY, ADMIN
    }
}
