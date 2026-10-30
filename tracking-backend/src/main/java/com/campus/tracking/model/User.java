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

    // Students belong to the department whose timetable they follow; faculty to the one they teach in.
    @JsonIgnore
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "department_id")
    private Department department;

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

    public Long getDepartmentId() {
        return department == null ? null : department.getId();
    }

    public String getDepartmentName() {
        return department == null ? null : department.getName();
    }

    public String getDepartmentCode() {
        return department == null ? null : department.getCode();
    }

    /** True when this user is recorded as the head of their own department. */
    public boolean getHeadOfDepartment() {
        return department != null && id != null && id.equals(department.getHeadUserId());
    }

    public enum Role {
        STUDENT, FACULTY, ADMIN
    }
}
