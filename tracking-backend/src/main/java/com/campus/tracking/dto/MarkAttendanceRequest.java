package com.campus.tracking.dto;

import com.campus.tracking.model.AttendanceRecord;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;

@Data
public class MarkAttendanceRequest {
    @NotNull(message = "Student is required")
    private Long userId;

    @NotNull(message = "Date is required")
    private LocalDate date;

    @NotNull(message = "Status is required")
    private AttendanceRecord.Status status;

    @Size(max = 255, message = "Note must be at most 255 characters")
    private String note;
}
