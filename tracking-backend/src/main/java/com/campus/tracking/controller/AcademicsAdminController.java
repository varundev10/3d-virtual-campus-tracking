package com.campus.tracking.controller;

import com.campus.tracking.dto.AcademicViews.ClassroomView;
import com.campus.tracking.dto.AcademicViews.DepartmentView;
import com.campus.tracking.dto.AcademicViews.SessionView;
import com.campus.tracking.dto.ClassroomRequest;
import com.campus.tracking.dto.DepartmentRequest;
import com.campus.tracking.dto.SessionRequest;
import com.campus.tracking.model.*;
import com.campus.tracking.repository.*;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;

// Departments, classrooms and the weekly timetable. Restricted to ROLE_ADMIN by SecurityConfig (/api/admin/**).
@RestController
@RequestMapping("/api/admin")
public class AcademicsAdminController {

    @Autowired
    private DepartmentRepository departmentRepository;

    @Autowired
    private ClassroomRepository classroomRepository;

    @Autowired
    private ClassSessionRepository sessionRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CampusLocationRepository campusLocationRepository;

    @Autowired
    private Clock clock;

    // ---- Departments ----

    @GetMapping("/departments")
    public List<DepartmentView> departments() {
        return departmentRepository.findAllByOrderByNameAsc().stream().map(this::view).toList();
    }

    @PostMapping("/departments")
    @Transactional
    public ResponseEntity<DepartmentView> createDepartment(@Valid @RequestBody DepartmentRequest request) {
        String code = request.getCode().trim().toUpperCase(Locale.ROOT);
        if (departmentRepository.findByCodeIgnoreCase(code).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A department with code " + code + " already exists");
        }
        Department department = new Department();
        department.setCode(code);
        department.setName(request.getName().trim());
        department = departmentRepository.save(department);
        applyHead(department, request.getHeadUserId());
        return ResponseEntity.status(HttpStatus.CREATED).body(view(departmentRepository.save(department)));
    }

    @PutMapping("/departments/{id}")
    @Transactional
    public DepartmentView updateDepartment(@PathVariable Long id, @Valid @RequestBody DepartmentRequest request) {
        Department department = requireDepartment(id);
        String code = request.getCode().trim().toUpperCase(Locale.ROOT);
        departmentRepository.findByCodeIgnoreCase(code).ifPresent(other -> {
            if (!other.getId().equals(id)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "A department with code " + code + " already exists");
            }
        });
        department.setCode(code);
        department.setName(request.getName().trim());
        applyHead(department, request.getHeadUserId());
        return view(departmentRepository.save(department));
    }

    @DeleteMapping("/departments/{id}")
    public ResponseEntity<Void> deleteDepartment(@PathVariable Long id) {
        Department department = requireDepartment(id);
        if (userRepository.countByDepartment_Id(id) > 0 || sessionRepository.countByDepartmentId(id) > 0
                || classroomRepository.findAll().stream().anyMatch(c -> c.getDepartment() != null && id.equals(c.getDepartment().getId()))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "This department still has people, classrooms or timetable entries. Move or remove them first.");
        }
        departmentRepository.delete(department);
        return ResponseEntity.noContent().build();
    }

    private void applyHead(Department department, Long headUserId) {
        if (headUserId == null) {
            department.setHeadUserId(null);
            return;
        }
        User head = userRepository.findById(headUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown head of department"));
        if (head.getRole() != User.Role.FACULTY) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The head of department must be a faculty member");
        }
        if (head.getDepartment() == null || !head.getDepartment().getId().equals(department.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Add " + head.getName() + " to this department before making them its head");
        }
        department.setHeadUserId(headUserId);
    }

    private DepartmentView view(Department d) {
        String headName = d.getHeadUserId() == null ? null
                : userRepository.findById(d.getHeadUserId()).map(User::getName).orElse(null);
        List<User> members = userRepository.findByDepartment(d.getId());
        long students = members.stream().filter(u -> u.getRole() == User.Role.STUDENT).count();
        long faculty = members.stream().filter(u -> u.getRole() == User.Role.FACULTY).count();
        return DepartmentView.of(d, headName, students, faculty);
    }

    // ---- Classrooms ----

    @GetMapping("/classrooms")
    public List<ClassroomView> classrooms() {
        return classroomRepository.findAllByOrderByCodeAsc().stream().map(ClassroomView::of).toList();
    }

    @PostMapping("/classrooms")
    public ResponseEntity<ClassroomView> createClassroom(@Valid @RequestBody ClassroomRequest request) {
        if (classroomRepository.findByCodeIgnoreCase(request.getCode().trim()).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A classroom with code " + request.getCode() + " already exists");
        }
        Classroom classroom = new Classroom();
        applyClassroom(classroom, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ClassroomView.of(classroomRepository.save(classroom)));
    }

    @PutMapping("/classrooms/{id}")
    public ClassroomView updateClassroom(@PathVariable Long id, @Valid @RequestBody ClassroomRequest request) {
        Classroom classroom = requireClassroom(id);
        classroomRepository.findByCodeIgnoreCase(request.getCode().trim()).ifPresent(other -> {
            if (!other.getId().equals(id)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "A classroom with code " + request.getCode() + " already exists");
            }
        });
        applyClassroom(classroom, request);
        return ClassroomView.of(classroomRepository.save(classroom));
    }

    @DeleteMapping("/classrooms/{id}")
    public ResponseEntity<Void> deleteClassroom(@PathVariable Long id) {
        Classroom classroom = requireClassroom(id);
        if (sessionRepository.countByClassroomId(id) > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "This classroom is used by the timetable. Remove or move those sessions first.");
        }
        classroomRepository.delete(classroom);
        return ResponseEntity.noContent().build();
    }

    private void applyClassroom(Classroom classroom, ClassroomRequest request) {
        Double latitude = request.getLatitude();
        Double longitude = request.getLongitude();
        String locationCode = request.getLocationCode() == null || request.getLocationCode().isBlank()
                ? null : request.getLocationCode().trim();

        if ((latitude == null) != (longitude == null)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Latitude and longitude must be given together");
        }
        if (locationCode != null) {
            CampusLocation location = campusLocationRepository.findByCodeIgnoreCase(locationCode)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown campus location " + request.getLocationCode()));
            locationCode = location.getCode();
            if (latitude == null) {
                latitude = location.getLatitude();
                longitude = location.getLongitude();
            }
        }
        if (latitude == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Give the room's coordinates or choose the campus location it is in");
        }

        classroom.setCode(request.getCode().trim());
        classroom.setName(request.getName().trim());
        classroom.setLocationCode(locationCode);
        classroom.setLatitude(latitude);
        classroom.setLongitude(longitude);
        classroom.setRadiusMeters(request.getRadiusMeters() == null ? Classroom.DEFAULT_RADIUS_METERS : request.getRadiusMeters());
        classroom.setFloorLevel(request.getFloorLevel());
        classroom.setCapacity(request.getCapacity());
        classroom.setDepartment(request.getDepartmentId() == null ? null : requireDepartment(request.getDepartmentId()));
    }

    // ---- Timetable ----

    @GetMapping("/sessions")
    public List<SessionView> sessions(@RequestParam(required = false) Long departmentId,
                                      @RequestParam(required = false) Long facultyId) {
        List<ClassSession> all = departmentId != null
                ? sessionRepository.findByDepartmentIdOrderByDayOfWeekAscStartTimeAsc(departmentId)
                : facultyId != null
                ? sessionRepository.findByFacultyIdOrderByDayOfWeekAscStartTimeAsc(facultyId)
                : sessionRepository.findAllByOrderByDayOfWeekAscStartTimeAsc();
        return all.stream().map(SessionView::of).toList();
    }

    @PostMapping("/sessions")
    public ResponseEntity<SessionView> createSession(@Valid @RequestBody SessionRequest request) {
        ClassSession session = new ClassSession();
        applySession(session, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(SessionView.of(sessionRepository.save(session)));
    }

    @PutMapping("/sessions/{id}")
    public SessionView updateSession(@PathVariable Long id, @Valid @RequestBody SessionRequest request) {
        ClassSession session = sessionRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Session not found"));
        applySession(session, request);
        return SessionView.of(sessionRepository.save(session));
    }

    @DeleteMapping("/sessions/{id}")
    public ResponseEntity<Void> deleteSession(@PathVariable Long id) {
        if (!sessionRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Session not found");
        }
        sessionRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private void applySession(ClassSession session, SessionRequest request) {
        if (!request.getEndTime().isAfter(request.getStartTime())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The end time must be after the start time");
        }
        Classroom classroom = requireClassroom(request.getClassroomId());
        Department department = requireDepartment(request.getDepartmentId());
        User faculty = null;
        if (request.getFacultyId() != null) {
            faculty = userRepository.findById(request.getFacultyId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown faculty member"));
            if (faculty.getRole() != User.Role.FACULTY) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, faculty.getName() + " is not a faculty member");
            }
        }
        boolean active = request.getActive() == null || request.getActive();

        if (active) {
            for (ClassSession other : sessionRepository.findByDayOfWeek(request.getDayOfWeek())) {
                if (other.getId().equals(session.getId()) || !other.isActiveSlot()) continue;
                boolean overlaps = request.getStartTime().isBefore(other.getEndTime())
                        && other.getStartTime().isBefore(request.getEndTime());
                if (!overlaps) continue;
                if (other.getClassroom().getId().equals(classroom.getId())) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT,
                            classroom.getCode() + " is already booked then for " + other.getSubject());
                }
                if (faculty != null && other.getFaculty() != null && other.getFaculty().getId().equals(faculty.getId())) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT,
                            faculty.getName() + " already teaches " + other.getSubject() + " at that time");
                }
            }
        }

        session.setSubject(request.getSubject().trim());
        session.setClassroom(classroom);
        session.setDepartment(department);
        session.setFaculty(faculty);
        session.setDayOfWeek(request.getDayOfWeek());
        session.setStartTime(request.getStartTime());
        session.setEndTime(request.getEndTime());
        session.setActive(active);
        session.setUpdatedAt(LocalDateTime.now(clock));
    }

    private Department requireDepartment(Long id) {
        return departmentRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Department not found"));
    }

    private Classroom requireClassroom(Long id) {
        return classroomRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Classroom not found"));
    }
}
