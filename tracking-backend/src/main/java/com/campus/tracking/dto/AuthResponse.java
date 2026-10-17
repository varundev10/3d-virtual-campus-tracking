package com.campus.tracking.dto;

import com.campus.tracking.model.User;
import java.time.Instant;

public record AuthResponse(String token, Instant expiresAt, User user) {
}
