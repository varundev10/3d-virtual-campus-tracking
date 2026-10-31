package com.campus.tracking.dto;

import com.campus.tracking.model.User;
import jakarta.validation.constraints.Size;
import lombok.Data;

/** Partial update; null fields are left unchanged. */
@Data
public class UpdateUserRequest {
    @Size(min = 1, max = 120, message = "Name must be 1-120 characters")
    private String name;

    private User.Role role;

    private Boolean active;

    // Moves the user to this department; null leaves it unchanged.
    private Long departmentId;

    // Removes the user from their department (departmentId is then ignored).
    private Boolean clearDepartment;
}
