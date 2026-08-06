package com.campus.tracking.config;

import com.campus.tracking.model.Classroom;
import com.campus.tracking.model.Department;
import com.campus.tracking.model.User;
import com.campus.tracking.repository.ClassroomRepository;
import com.campus.tracking.repository.DepartmentRepository;
import com.campus.tracking.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.Set;

// Seeds one demo department with a Student/Teacher/HOD login so the app is usable right after
// startup, without needing a self-registration flow (accounts are otherwise provisioned by HODs).
@Component
public class DataSeeder implements CommandLineRunner {

    @Autowired
    private DepartmentRepository departmentRepository;

    @Autowired
    private ClassroomRepository classroomRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Value("${app.seed.enabled:true}")
    private boolean seedEnabled;

    @Override
    public void run(String... args) {
        if (!seedEnabled || userRepository.count() > 0) {
            return;
        }

        Department cse = new Department();
        cse.setName("Computer Science & Engineering");
        cse.setCode("CSE");
        cse = departmentRepository.save(cse);

        Classroom a204 = newClassroom("A-204", "Academic Block A", 60, cse);
        newClassroom("B-112", "Academic Block B", 55, cse);
        newClassroom("LAB-3", "Labs Complex", 40, cse);
        newClassroom("LIB-HALL", "Library", 120, cse);

        User hod = new User();
        hod.setName("Dr. Radhika Menon");
        hod.setEmail("hod.cse@ucer.edu");
        hod.setPasswordHash(passwordEncoder.encode("Hod@1234"));
        hod.setRole(User.Role.HOD);
        hod.setDepartment(cse);
        userRepository.save(hod);

        User teacher = new User();
        teacher.setName("Nisha Verma");
        teacher.setEmail("nisha.verma@ucer.edu");
        teacher.setPasswordHash(passwordEncoder.encode("Teach@1234"));
        teacher.setRole(User.Role.TEACHER);
        teacher.setDepartment(cse);
        teacher = userRepository.save(teacher);

        a204.setTeachers(Set.of(teacher));
        classroomRepository.save(a204);

        User student = new User();
        student.setName("Aarav Singh");
        student.setEmail("aarav.singh@ucer.edu");
        student.setPasswordHash(passwordEncoder.encode("Student@1234"));
        student.setRole(User.Role.STUDENT);
        student.setDepartment(cse);
        userRepository.save(student);

        System.out.println("[DataSeeder] Seeded CSE department with demo logins:");
        System.out.println("[DataSeeder]   HOD:     hod.cse@ucer.edu / Hod@1234");
        System.out.println("[DataSeeder]   Teacher: nisha.verma@ucer.edu / Teach@1234");
        System.out.println("[DataSeeder]   Student: aarav.singh@ucer.edu / Student@1234");
    }

    private Classroom newClassroom(String code, String building, int capacity, Department department) {
        Classroom classroom = new Classroom();
        classroom.setCode(code);
        classroom.setBuilding(building);
        classroom.setCapacity(capacity);
        classroom.setDepartment(department);
        return classroomRepository.save(classroom);
    }
}
