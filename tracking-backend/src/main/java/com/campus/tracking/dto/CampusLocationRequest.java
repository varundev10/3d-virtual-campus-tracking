package com.campus.tracking.dto;

import com.campus.tracking.model.CampusLocation;
import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class CampusLocationRequest {
    @NotBlank(message = "Code is required")
    @Pattern(regexp = "^[A-Z0-9][A-Z0-9-]{1,31}$",
            message = "Code must be 2-32 uppercase letters, digits or hyphens")
    private String code;

    @NotBlank(message = "Name is required")
    @Size(max = 120, message = "Name must be at most 120 characters")
    private String name;

    @NotNull(message = "Category is required")
    private CampusLocation.Category category;

    @Size(max = 1000, message = "Description must be at most 1000 characters")
    private String description;

    @NotNull(message = "Latitude is required")
    @DecimalMin(value = "-90", message = "Latitude must be between -90 and 90")
    @DecimalMax(value = "90", message = "Latitude must be between -90 and 90")
    private Double latitude;

    @NotNull(message = "Longitude is required")
    @DecimalMin(value = "-180", message = "Longitude must be between -180 and 180")
    @DecimalMax(value = "180", message = "Longitude must be between -180 and 180")
    private Double longitude;
}
