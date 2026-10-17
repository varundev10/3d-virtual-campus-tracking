package com.campus.tracking.dto;

import com.campus.tracking.model.User;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

/** Same shape as the original POST /api/users body, plus an optional initial password. */
@Data
public class CreateUserRequest {
    @NotBlank(message = "Name is required")
    @Size(max = 120, message = "Name must be at most 120 characters")
    private String name;

    @NotBlank(message = "Email is required")
    @Email(message = "Enter a valid email address")
    @Size(max = 255)
    private String email;

    @NotNull(message = "Role is required")
    private User.Role role;

    @Size(min = 8, max = 72, message = "Password must be 8-72 characters")
    private String password;
}
