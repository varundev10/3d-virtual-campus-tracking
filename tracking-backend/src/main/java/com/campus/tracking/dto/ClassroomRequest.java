package com.campus.tracking.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class ClassroomRequest {
    @NotBlank(message = "Code is required")
    @Pattern(regexp = "[A-Za-z0-9_-]{1,32}", message = "Use letters, digits, '-' or '_' (max 32)")
    private String code;

    @NotBlank(message = "Name is required")
    @Size(max = 120, message = "Name must be at most 120 characters")
    private String name;

    // Campus location (building) the room is in. When latitude/longitude are left out they come from it.
    @Size(max = 32)
    private String locationCode;

    @DecimalMin(value = "-90", message = "Latitude must be between -90 and 90")
    @DecimalMax(value = "90", message = "Latitude must be between -90 and 90")
    private Double latitude;

    @DecimalMin(value = "-180", message = "Longitude must be between -180 and 180")
    @DecimalMax(value = "180", message = "Longitude must be between -180 and 180")
    private Double longitude;

    @Min(value = 5, message = "Radius must be at least 5 m")
    @Max(value = 200, message = "Radius must be at most 200 m")
    private Integer radiusMeters;

    @Min(value = -5, message = "Floor must be between -5 and 50")
    @Max(value = 50, message = "Floor must be between -5 and 50")
    private Integer floorLevel;

    @Min(value = 1, message = "Capacity must be at least 1")
    @Max(value = 5000, message = "Capacity must be at most 5000")
    private Integer capacity;

    private Long departmentId;
}
