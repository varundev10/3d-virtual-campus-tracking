package com.campus.tracking.repository;

import com.campus.tracking.model.ClassSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.DayOfWeek;
import java.util.Collection;
import java.util.List;

public interface ClassSessionRepository extends JpaRepository<ClassSession, Long> {

    List<ClassSession> findByDayOfWeek(DayOfWeek dayOfWeek);

    List<ClassSession> findByDepartmentIdOrderByDayOfWeekAscStartTimeAsc(Long departmentId);

    List<ClassSession> findByFacultyIdOrderByDayOfWeekAscStartTimeAsc(Long facultyId);

    List<ClassSession> findByDepartmentIdInOrderByDayOfWeekAscStartTimeAsc(Collection<Long> departmentIds);

    List<ClassSession> findAllByOrderByDayOfWeekAscStartTimeAsc();

    long countByClassroomId(Long classroomId);

    long countByDepartmentId(Long departmentId);

    long countByFacultyId(Long facultyId);

    @Query("select s from ClassSession s where s.faculty.id = :facultyId or s.department.id in :departmentIds "
            + "order by s.dayOfWeek, s.startTime")
    List<ClassSession> findTaughtByOrInDepartments(@Param("facultyId") Long facultyId,
                                                  @Param("departmentIds") Collection<Long> departmentIds);
}
