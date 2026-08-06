package com.campus.tracking.dto;

import com.campus.tracking.model.User;
import lombok.Data;

@Data
public class CreateUserRequest {
    private String name;
    private String email;
    private String password;
    private User.Role role;
}
