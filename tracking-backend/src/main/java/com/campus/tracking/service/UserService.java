package com.campus.tracking.service;

import com.campus.tracking.dto.CreateUserRequest;
import com.campus.tracking.model.User;
import com.campus.tracking.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class UserService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    public User createDepartmentMember(CreateUserRequest request, User.Role callerRole, com.campus.tracking.model.Department department) {
        if (request.getRole() == User.Role.HOD) {
            throw new IllegalArgumentException("Cannot create another HOD account");
        }

        User user = new User();
        user.setName(request.getName());
        user.setEmail(request.getEmail());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setRole(request.getRole());
        user.setDepartment(department);
        return userRepository.save(user);
    }
}
