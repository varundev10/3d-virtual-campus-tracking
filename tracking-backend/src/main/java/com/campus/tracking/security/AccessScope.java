package com.campus.tracking.security;

import com.campus.tracking.model.ClassSession;
import com.campus.tracking.model.Department;
import com.campus.tracking.model.User;
import com.campus.tracking.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashSet;
import java.util.Set;

/**
 * "Who may see or act on whom" for the department-scoped features:
 * admins see everything; a head of department sees everyone in their department; other faculty see the students
 * of their department; students see only themselves. Faculty may run attendance for the sessions they teach, and
 * a head for every session of their department.
 */
@Component
public class AccessScope {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CurrentUser currentUser;

    public User caller() {
        return userRepository.findById(currentUser.id())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required"));
    }

    public static boolean isAdmin(User user) {
        return user.getRole() == User.Role.ADMIN;
    }

    public static boolean heads(User user, Department department) {
        return department != null && user.getId() != null && user.getId().equals(department.getHeadUserId());
    }

    public boolean canManage(User caller, ClassSession session) {
        if (isAdmin(caller)) return true;
        if (caller.getRole() != User.Role.FACULTY) return false;
        return (session.getFaculty() != null && session.getFaculty().getId().equals(caller.getId()))
                || heads(caller, session.getDepartment());
    }

    public ClassSession requireManageable(User caller, ClassSession session) {
        if (!canManage(caller, session)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not run this session");
        }
        return session;
    }

    /**
     * Ids of the users whose records the caller may see, or {@code null} for "everyone" (admin).
     * Always includes the caller.
     */
    public Set<Long> visibleUserIds(User caller) {
        if (isAdmin(caller)) return null;
        Set<Long> ids = new HashSet<>();
        ids.add(caller.getId());
        if (caller.getRole() == User.Role.FACULTY && caller.getDepartment() != null) {
            boolean head = heads(caller, caller.getDepartment());
            for (User member : userRepository.findByDepartment(caller.getDepartment().getId())) {
                if (head || member.getRole() == User.Role.STUDENT) ids.add(member.getId());
            }
        }
        return ids;
    }

    public boolean canSee(User caller, Long userId) {
        Set<Long> ids = visibleUserIds(caller);
        return ids == null || ids.contains(userId);
    }
}
