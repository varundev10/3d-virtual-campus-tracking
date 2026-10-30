package com.campus.tracking.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.DayOfWeek;
import java.time.LocalTime;

@Data
public class SessionRequest {
    @NotBlank(message = "Subject is required")
    @Size(max = 120, message = "Subject must be at most 120 characters")
    private String subject;

    @NotNull(message = "Classroom is required")
    private Long classroomId;

    @NotNull(message = "Department is required")
    private Long departmentId;

    private Long facultyId;

    @NotNull(message = "Day of week is required")
    private DayOfWeek dayOfWeek;

    @NotNull(message = "Start time is required")
    private LocalTime startTime;

    @NotNull(message = "End time is required")
    private LocalTime endTime;

    private Boolean active;
}
