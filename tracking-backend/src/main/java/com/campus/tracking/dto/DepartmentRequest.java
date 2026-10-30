package com.campus.tracking.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class DepartmentRequest {
    @NotBlank(message = "Code is required")
    @Pattern(regexp = "[A-Za-z0-9_-]{2,20}", message = "Use 2-20 letters, digits, '-' or '_'")
    private String code;

    @NotBlank(message = "Name is required")
    @Size(max = 150, message = "Name must be at most 150 characters")
    private String name;

    // Optional: a faculty member of this department to head it.
    private Long headUserId;
}
