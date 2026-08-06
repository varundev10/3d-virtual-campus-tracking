package com.campus.tracking.security;

import com.campus.tracking.model.Classroom;
import com.campus.tracking.model.User;
import org.springframework.stereotype.Component;

// Central place for the "who can see/act on whom" rules referenced from the controllers.
// There's no student-classroom enrollment table (out of the approved scope), so teacher/HOD
// read access is department-wide; marking attendance is still restricted to classrooms a
// teacher is actually assigned to via classroom_teachers.
@Component
public class AccessGuard {

    public boolean isSelf(AppUserPrincipal principal, Long userId) {
        return principal.getUserId().equals(userId);
    }

    private boolean sameDepartment(AppUserPrincipal principal, User target) {
        Long principalDept = principal.getDepartmentId();
        Long targetDept = target.getDepartment() != null ? target.getDepartment().getId() : null;
        return principalDept != null && principalDept.equals(targetDept);
    }

    public boolean canView(AppUserPrincipal principal, User target) {
        if (isSelf(principal, target.getId())) return true;
        if (principal.getRole() == User.Role.HOD || principal.getRole() == User.Role.TEACHER) {
            return sameDepartment(principal, target);
        }
        return false;
    }

    public boolean canManageMembers(AppUserPrincipal principal) {
        return principal.getRole() == User.Role.HOD;
    }

    public boolean teachesClassroom(AppUserPrincipal principal, Classroom classroom) {
        return classroom.getTeachers().stream()
                .anyMatch(teacher -> teacher.getId().equals(principal.getUserId()));
    }
}
