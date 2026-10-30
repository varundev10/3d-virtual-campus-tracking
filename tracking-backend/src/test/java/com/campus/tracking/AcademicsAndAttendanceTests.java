package com.campus.tracking;

import com.campus.tracking.model.Alert;
import com.campus.tracking.model.AttendanceRecord;
import com.campus.tracking.repository.AlertRepository;
import com.campus.tracking.repository.AttendanceRecordRepository;
import com.campus.tracking.service.AttendanceEngine;
import com.campus.tracking.service.GeofenceService;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Timetable, GPS attendance, bunk/absence finalization, alerts, scoping and exports. */
// Own database, and the background sweep pushed far out so only the test's explicit finalizeEnded() calls run.
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:academics;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
        "app.attendance.sweep-seconds=86400"})
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(AcademicsAndAttendanceTests.TestClockConfig.class)
class AcademicsAndAttendanceTests {

    // Mondays 2026-11-02. The room is at the campus centre; the "hallway" is ~44 m north (on campus, outside the room).
    private static final LocalDate MONDAY = LocalDate.of(2026, 11, 2);
    private static final double ROOM_LAT = 25.3438271534, ROOM_LNG = 81.9106717343;
    private static final double HALL_LAT = 25.3442271534, HALL_LNG = 81.9106717343;
    private static final double FAR_LAT = 25.3428, FAR_LNG = 81.9104;

    @TestConfiguration
    static class TestClockConfig {
        @Bean
        @Primary
        MutableClock testClock() {
            return new MutableClock(ZoneId.of("Asia/Kolkata"), MONDAY.atTime(9, 0));
        }
    }

    @Autowired
    private MockMvc mvc;
    @Autowired
    private MutableClock clock;
    @Autowired
    private AttendanceEngine engine;
    @Autowired
    private AttendanceRecordRepository attendanceRepository;
    @Autowired
    private AlertRepository alertRepository;
    @Autowired
    private GeofenceService geofenceService;

    private record Person(long id, String token) {
        String bearer() {
            return "Bearer " + token;
        }
    }

    private record Fixture(long departmentId, long classroomId, long sessionId, Person faculty, Person s1, Person s2,
                           Person s3) {
    }

    @BeforeEach
    void resetClock() {
        clock.set(MONDAY.atTime(9, 0));
    }

    // ---- helpers ----

    private static String unique() {
        return UUID.randomUUID().toString().substring(0, 8);
    }

    private Person admin() throws Exception {
        return login("admin@test.local", "AdminPass123");
    }

    private Person login(String email, String password) throws Exception {
        String body = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return new Person(((Number) JsonPath.read(body, "$.user.id")).longValue(), JsonPath.read(body, "$.token"));
    }

    private ResultActions send(Person p, MockHttpServletRequestBuilder builder, String json) throws Exception {
        MockHttpServletRequestBuilder b = builder.header("Authorization", p.bearer());
        if (json != null) b = b.contentType(MediaType.APPLICATION_JSON).content(json);
        return mvc.perform(b);
    }

    private long idOf(ResultActions result) throws Exception {
        return ((Number) JsonPath.read(result.andReturn().getResponse().getContentAsString(), "$.id")).longValue();
    }

    private long createDepartment(Person admin) throws Exception {
        String code = "D" + unique().toUpperCase(Locale.ROOT);
        return idOf(send(admin, post("/api/admin/departments"), "{\"code\":\"" + code + "\",\"name\":\"Dept " + code + "\"}")
                .andExpect(status().isCreated()));
    }

    private Person createUser(Person admin, String name, String role, long departmentId) throws Exception {
        String email = "u" + unique() + "@test.local";
        send(admin, post("/api/users"), "{\"name\":\"" + name + "\",\"email\":\"" + email + "\",\"role\":\"" + role
                + "\",\"password\":\"Password123\",\"departmentId\":" + departmentId + "}").andExpect(status().isOk());
        return login(email, "Password123");
    }

    private long createClassroom(Person admin, long departmentId, Integer floor) throws Exception {
        String floorJson = floor == null ? "" : ",\"floorLevel\":" + floor;
        return idOf(send(admin, post("/api/admin/classrooms"), "{\"code\":\"R" + unique() + "\",\"name\":\"Room\",\"latitude\":"
                + ROOM_LAT + ",\"longitude\":" + ROOM_LNG + ",\"radiusMeters\":25" + floorJson + ",\"departmentId\":" + departmentId + "}")
                .andExpect(status().isCreated()));
    }

    private ResultActions createSession(Person admin, long classroomId, long departmentId, Long facultyId, String start,
                                        String end) throws Exception {
        return send(admin, post("/api/admin/sessions"), "{\"subject\":\"Data Structures\",\"classroomId\":" + classroomId
                + ",\"departmentId\":" + departmentId + (facultyId == null ? "" : ",\"facultyId\":" + facultyId)
                + ",\"dayOfWeek\":\"MONDAY\",\"startTime\":\"" + start + "\",\"endTime\":\"" + end + "\"}");
    }

    private Fixture fixture() throws Exception {
        Person admin = admin();
        long dept = createDepartment(admin);
        Person faculty = createUser(admin, "Prof Rao", "FACULTY", dept);
        Person s1 = createUser(admin, "Asha", "STUDENT", dept);
        Person s2 = createUser(admin, "Bilal", "STUDENT", dept);
        Person s3 = createUser(admin, "Chitra", "STUDENT", dept);
        long room = createClassroom(admin, dept, null);
        long session = idOf(createSession(admin, room, dept, faculty.id(), "10:00", "11:00").andExpect(status().isCreated()));
        return new Fixture(dept, room, session, faculty, s1, s2, s3);
    }

    private void ping(Person p, double lat, double lng) throws Exception {
        send(p, post("/api/locations"), "{\"latitude\":" + lat + ",\"longitude\":" + lng + ",\"source\":\"GPS\"}")
                .andExpect(status().isOk());
    }

    private AttendanceRecord record(Fixture f, Person student) {
        return attendanceRepository.findByUserIdAndSessionIdAndSessionDate(student.id(), f.sessionId(), MONDAY).orElse(null);
    }

    // ---- GPS attendance ----

    @Test
    void geofenceFixturesAreOnCampus() {
        assertThat(geofenceService.isInsideCampus(ROOM_LAT, ROOM_LNG)).isTrue();
        assertThat(geofenceService.isInsideCampus(HALL_LAT, HALL_LNG)).isTrue();
        assertThat(geofenceService.isInsideCampus(FAR_LAT, FAR_LNG)).isTrue();
    }

    @Test
    void studentInsideTheRoomIsMarkedPresentOnceAtArrival() throws Exception {
        Fixture f = fixture();
        clock.set(MONDAY.atTime(10, 5));
        ping(f.s1(), ROOM_LAT, ROOM_LNG);
        clock.set(MONDAY.atTime(10, 20));
        ping(f.s1(), ROOM_LAT, ROOM_LNG);

        List<AttendanceRecord> all = attendanceRepository.findBySessionIdAndSessionDate(f.sessionId(), MONDAY);
        assertThat(all).hasSize(1);
        AttendanceRecord r = all.get(0);
        assertThat(r.getUserId()).isEqualTo(f.s1().id());
        assertThat(r.getStatus()).isEqualTo(AttendanceRecord.Status.PRESENT);
        assertThat(r.getMethod()).isEqualTo(AttendanceRecord.Method.AUTO);
        assertThat(r.getCheckTime()).isEqualTo(MONDAY.atTime(10, 5));
    }

    @Test
    void arrivingEarlyCountsButArrivingBeforeTheWindowDoesNot() throws Exception {
        Fixture f = fixture();
        clock.set(MONDAY.atTime(9, 30));
        ping(f.s1(), ROOM_LAT, ROOM_LNG);
        assertThat(record(f, f.s1())).isNull();

        clock.set(MONDAY.atTime(9, 52));
        ping(f.s1(), ROOM_LAT, ROOM_LNG);
        assertThat(record(f, f.s1())).isNotNull();
    }

    @Test
    void pingOutsideTheRoomOrOnTheWrongFloorIsNotPresence() throws Exception {
        Person admin = admin();
        long dept = createDepartment(admin);
        Person student = createUser(admin, "Dev", "STUDENT", dept);
        long upstairs = createClassroom(admin, dept, 2);
        long sessionId = idOf(createSession(admin, upstairs, dept, null, "10:00", "11:00").andExpect(status().isCreated()));

        clock.set(MONDAY.atTime(10, 10));
        ping(student, HALL_LAT, HALL_LNG);
        assertThat(attendanceRepository.findByUserIdAndSessionIdAndSessionDate(student.id(), sessionId, MONDAY)).isEmpty();

        // Right place, ground floor (the client's default), but the room is on floor 2.
        ping(student, ROOM_LAT, ROOM_LNG);
        assertThat(attendanceRepository.findByUserIdAndSessionIdAndSessionDate(student.id(), sessionId, MONDAY)).isEmpty();

        send(student, post("/api/locations"), "{\"latitude\":" + ROOM_LAT + ",\"longitude\":" + ROOM_LNG + ",\"floorLevel\":2}")
                .andExpect(status().isOk());
        assertThat(attendanceRepository.findByUserIdAndSessionIdAndSessionDate(student.id(), sessionId, MONDAY)).isPresent();
    }

    @Test
    void anotherDepartmentsStudentIsNotMarkedForThisSession() throws Exception {
        Fixture f = fixture();
        Person admin = admin();
        long otherDept = createDepartment(admin);
        Person outsider = createUser(admin, "Eve", "STUDENT", otherDept);
        clock.set(MONDAY.atTime(10, 10));
        ping(outsider, ROOM_LAT, ROOM_LNG);
        assertThat(attendanceRepository.findByUserIdAndSessionIdAndSessionDate(outsider.id(), f.sessionId(), MONDAY)).isEmpty();
    }

    @Test
    void nothingIsFinalizedWhileTheSessionOrItsGracePeriodIsRunning() throws Exception {
        Fixture f = fixture();
        clock.set(MONDAY.atTime(10, 30));
        engine.finalizeEnded(clock.time());
        clock.set(MONDAY.atTime(11, 2));            // ended at 11:00, grace runs to 11:05
        engine.finalizeEnded(clock.time());
        assertThat(attendanceRepository.findBySessionIdAndSessionDate(f.sessionId(), MONDAY)).isEmpty();
    }

    @Test
    void afterTheGracePeriodAbsenteesAreFinalizedExactlyOnce() throws Exception {
        Fixture f = fixture();
        clock.set(MONDAY.atTime(10, 5));
        ping(f.s1(), ROOM_LAT, ROOM_LNG);
        clock.set(MONDAY.atTime(10, 20));
        ping(f.s2(), HALL_LAT, HALL_LNG);

        clock.set(MONDAY.atTime(11, 6));
        assertThat(engine.finalizeEnded(clock.time())).isGreaterThanOrEqualTo(1);

        assertThat(record(f, f.s1()).getStatus()).isEqualTo(AttendanceRecord.Status.PRESENT);
        assertThat(record(f, f.s2()).getStatus()).isEqualTo(AttendanceRecord.Status.BUNKED);
        assertThat(record(f, f.s2()).getMethod()).isEqualTo(AttendanceRecord.Method.AUTO);
        assertThat(record(f, f.s3()).getStatus()).isEqualTo(AttendanceRecord.Status.ABSENT);

        List<Alert> alerts = alertRepository.findAll();
        assertThat(alerts).anySatisfy(a -> {
            assertThat(a.getType()).isEqualTo(Alert.AlertType.BUNK_DETECTED);
            assertThat(a.getUserId()).isEqualTo(f.s2().id());
            assertThat(a.getMessage()).contains("Bilal").contains("Data Structures");
        });
        assertThat(alerts).noneSatisfy(a -> {
            assertThat(a.getType()).isEqualTo(Alert.AlertType.BUNK_DETECTED);
            assertThat(a.getUserId()).isIn(f.s1().id(), f.s3().id());
        });
        assertThat(alerts).anySatisfy(a -> {
            assertThat(a.getType()).isEqualTo(Alert.AlertType.FACULTY_OFF_SCHEDULE);
            assertThat(a.getUserId()).isEqualTo(f.faculty().id());
        });

        long bunkAlerts = alertRepository.findAll().stream().filter(a -> a.getUserId().equals(f.s2().id())).count();
        engine.finalizeEnded(clock.time());
        assertThat(alertRepository.findAll().stream().filter(a -> a.getUserId().equals(f.s2().id())).count()).isEqualTo(bunkAlerts);
        assertThat(attendanceRepository.findBySessionIdAndSessionDate(f.sessionId(), MONDAY)).hasSize(3);
    }

    @Test
    void aFacultyMemberWhoTaughtTheClassRaisesNoAlert() throws Exception {
        Fixture f = fixture();
        clock.set(MONDAY.atTime(10, 1));
        ping(f.faculty(), ROOM_LAT, ROOM_LNG);
        clock.set(MONDAY.atTime(11, 6));
        engine.finalizeEnded(clock.time());
        assertThat(alertRepository.findAll()).noneSatisfy(a -> {
            assertThat(a.getType()).isEqualTo(Alert.AlertType.FACULTY_OFF_SCHEDULE);
            assertThat(a.getUserId()).isEqualTo(f.faculty().id());
        });
    }

    @Test
    void aSessionAddedAfterItStartedIsNotFinalizedForThatDay() throws Exception {
        Person admin = admin();
        long dept = createDepartment(admin);
        Person student = createUser(admin, "Late Bird", "STUDENT", dept);
        long room = createClassroom(admin, dept, null);

        clock.set(MONDAY.atTime(15, 0));
        long sessionId = idOf(createSession(admin, room, dept, null, "10:00", "11:00").andExpect(status().isCreated()));
        engine.finalizeEnded(clock.time());
        assertThat(attendanceRepository.findByUserIdAndSessionIdAndSessionDate(student.id(), sessionId, MONDAY)).isEmpty();
    }

    // ---- manual marks and roster ----

    @Test
    void facultyCanOverrideAnAutomaticMarkAndOnlyForTheirOwnSession() throws Exception {
        Fixture f = fixture();
        Person admin = admin();
        Person otherFaculty = createUser(admin, "Prof Other", "FACULTY", f.departmentId());
        clock.set(MONDAY.atTime(11, 6));
        engine.finalizeEnded(clock.time());
        assertThat(record(f, f.s3()).getStatus()).isEqualTo(AttendanceRecord.Status.ABSENT);

        String body = "{\"userId\":" + f.s3().id() + ",\"date\":\"" + MONDAY + "\",\"status\":\"PRESENT\",\"note\":\"Phone had no signal\"}";
        send(f.faculty(), put("/api/faculty/sessions/" + f.sessionId() + "/attendance"), body)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PRESENT"))
                .andExpect(jsonPath("$.method").value("MANUAL"))
                .andExpect(jsonPath("$.markedBy").value(f.faculty().id()));
        assertThat(record(f, f.s3()).getNote()).isEqualTo("Phone had no signal");

        send(otherFaculty, put("/api/faculty/sessions/" + f.sessionId() + "/attendance"), body).andExpect(status().isForbidden());
        send(f.s1(), put("/api/faculty/sessions/" + f.sessionId() + "/attendance"), body).andExpect(status().isForbidden());
        send(f.s1(), get("/api/faculty/sessions/" + f.sessionId() + "/roster"), null).andExpect(status().isForbidden());
    }

    @Test
    void manualMarksRejectFutureDatesWrongWeekdaysAndStrangers() throws Exception {
        Fixture f = fixture();
        Person admin = admin();
        long otherDept = createDepartment(admin);
        Person stranger = createUser(admin, "Stranger", "STUDENT", otherDept);
        clock.set(MONDAY.atTime(10, 30));

        String future = "{\"userId\":" + f.s1().id() + ",\"date\":\"" + MONDAY.plusDays(7) + "\",\"status\":\"PRESENT\"}";
        send(f.faculty(), put("/api/faculty/sessions/" + f.sessionId() + "/attendance"), future).andExpect(status().isBadRequest());

        String tuesday = "{\"userId\":" + f.s1().id() + ",\"date\":\"" + MONDAY.minusDays(6) + "\",\"status\":\"PRESENT\"}";
        send(f.faculty(), put("/api/faculty/sessions/" + f.sessionId() + "/attendance"), tuesday).andExpect(status().isBadRequest());

        String wrongDept = "{\"userId\":" + stranger.id() + ",\"date\":\"" + MONDAY + "\",\"status\":\"PRESENT\"}";
        send(f.faculty(), put("/api/faculty/sessions/" + f.sessionId() + "/attendance"), wrongDept).andExpect(status().isBadRequest());
    }

    @Test
    void headOfDepartmentRunsEverySessionInTheirDepartmentAndSeesTheRoster() throws Exception {
        Fixture f = fixture();
        Person admin = admin();
        Person head = createUser(admin, "Dr Head", "FACULTY", f.departmentId());
        send(admin, put("/api/admin/departments/" + f.departmentId()),
                "{\"code\":\"HD" + unique() + "\",\"name\":\"Dept\",\"headUserId\":" + head.id() + "}").andExpect(status().isOk())
                .andExpect(jsonPath("$.headUserId").value(head.id()));

        clock.set(MONDAY.atTime(10, 5));
        ping(f.s1(), ROOM_LAT, ROOM_LNG);
        send(head, get("/api/faculty/sessions/" + f.sessionId() + "/roster?date=" + MONDAY), null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.live").value(true))
                .andExpect(jsonPath("$.entries.length()").value(3))
                .andExpect(jsonPath("$.entries[?(@.name=='Asha')].status").value(hasItem("PRESENT")))
                .andExpect(jsonPath("$.entries[?(@.name=='Asha')].inRoomNow").value(hasItem(true)))
                .andExpect(jsonPath("$.entries[?(@.name=='Bilal')].status").value(hasItem(nullValue())));
        send(head, get("/api/auth/me"), null).andExpect(jsonPath("$.headOfDepartment").value(true));
    }

    @Test
    void aHeadMustBeFacultyInTheDepartment() throws Exception {
        Fixture f = fixture();
        Person admin = admin();
        send(admin, put("/api/admin/departments/" + f.departmentId()),
                "{\"code\":\"X" + unique() + "\",\"name\":\"Dept\",\"headUserId\":" + f.s1().id() + "}").andExpect(status().isBadRequest());
        long otherDept = createDepartment(admin);
        Person foreign = createUser(admin, "Prof Foreign", "FACULTY", otherDept);
        send(admin, put("/api/admin/departments/" + f.departmentId()),
                "{\"code\":\"Y" + unique() + "\",\"name\":\"Dept\",\"headUserId\":" + foreign.id() + "}").andExpect(status().isBadRequest());
    }

    // ---- timetable validation ----

    @Test
    void overlappingBookingsForARoomOrAFacultyMemberAreRejected() throws Exception {
        Fixture f = fixture();
        Person admin = admin();
        createSession(admin, f.classroomId(), f.departmentId(), null, "10:30", "11:30").andExpect(status().isConflict());

        long otherRoom = createClassroom(admin, f.departmentId(), null);
        createSession(admin, otherRoom, f.departmentId(), f.faculty().id(), "10:30", "11:30").andExpect(status().isConflict());
        createSession(admin, otherRoom, f.departmentId(), f.faculty().id(), "11:00", "12:00").andExpect(status().isCreated());
        createSession(admin, otherRoom, f.departmentId(), null, "12:00", "11:00").andExpect(status().isBadRequest());
    }

    @Test
    void departmentsWithPeopleCannotBeDeletedAndCodesAreUnique() throws Exception {
        Fixture f = fixture();
        Person admin = admin();
        send(admin, delete("/api/admin/departments/" + f.departmentId()), null).andExpect(status().isConflict());
        send(admin, delete("/api/admin/classrooms/" + f.classroomId()), null).andExpect(status().isConflict());

        String code = "U" + unique();
        send(admin, post("/api/admin/departments"), "{\"code\":\"" + code + "\",\"name\":\"One\"}").andExpect(status().isCreated());
        send(admin, post("/api/admin/departments"), "{\"code\":\"" + code.toLowerCase(Locale.ROOT) + "\",\"name\":\"Two\"}")
                .andExpect(status().isConflict());
    }

    @Test
    void timetableAndDepartmentEndpointsAreRoleProtected() throws Exception {
        Fixture f = fixture();
        send(f.s1(), get("/api/admin/sessions"), null).andExpect(status().isForbidden());
        send(f.faculty(), post("/api/admin/classrooms"), "{}").andExpect(status().isForbidden());
        send(f.s1(), get("/api/faculty/overview"), null).andExpect(status().isForbidden());
        mvc.perform(get("/api/faculty/overview")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/auth/departments")).andExpect(status().isOk()).andExpect(jsonPath("$[0].id").exists())
                .andExpect(jsonPath("$[0].headUserId").doesNotExist());
    }

    // ---- students' own views ----

    @Test
    void registrationCanChooseADepartmentAndTheStudentSeesTheirTimetable() throws Exception {
        Fixture f = fixture();
        String email = "reg" + unique() + "@test.local";
        String body = mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"New Student\",\"email\":\"" + email + "\",\"password\":\"Password123\",\"departmentId\":"
                                + f.departmentId() + "}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.user.departmentId").value(f.departmentId()))
                .andReturn().getResponse().getContentAsString();
        Person me = new Person(0, JsonPath.read(body, "$.token"));

        clock.set(MONDAY.atTime(9, 0));
        send(me, get("/api/me/schedule"), null).andExpect(status().isOk())
                .andExpect(jsonPath("$.today").value(MONDAY.toString()))
                .andExpect(jsonPath("$.sessions.length()").value(1))
                .andExpect(jsonPath("$.sessions[0].subject").value("Data Structures"));

        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Bad\",\"email\":\"bad" + unique() + "@test.local\",\"password\":\"Password123\",\"departmentId\":999999}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void attendanceSummaryCountsAbsentAndBunkedAgainstTheStudent() throws Exception {
        Fixture f = fixture();
        clock.set(MONDAY.atTime(10, 5));
        ping(f.s1(), ROOM_LAT, ROOM_LNG);
        ping(f.s2(), HALL_LAT, HALL_LNG);
        clock.set(MONDAY.atTime(11, 6));
        engine.finalizeEnded(clock.time());

        send(f.s1(), get("/api/me/attendance/summary?days=30"), null).andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1)).andExpect(jsonPath("$.present").value(1))
                .andExpect(jsonPath("$.overallPercent").value(100.0))
                .andExpect(jsonPath("$.subjects[0].subject").value("Data Structures"));
        send(f.s2(), get("/api/me/attendance/summary?days=30"), null).andExpect(status().isOk())
                .andExpect(jsonPath("$.bunked").value(1)).andExpect(jsonPath("$.overallPercent").value(0.0));
    }

    // ---- alerts: scoping, acknowledgement, anomaly detection ----

    @Test
    void alertsAreScopedAndOnlyStaffInScopeCanAcknowledge() throws Exception {
        Fixture f = fixture();
        Person admin = admin();
        long otherDept = createDepartment(admin);
        Person otherFaculty = createUser(admin, "Prof Away", "FACULTY", otherDept);

        clock.set(MONDAY.atTime(10, 5));
        ping(f.s2(), HALL_LAT, HALL_LNG);
        clock.set(MONDAY.atTime(11, 6));
        engine.finalizeEnded(clock.time());

        String own = send(f.s2(), get("/api/alerts?type=BUNK_DETECTED&size=100"), null).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertThat(JsonPath.<List<Integer>>read(own, "$.content[*].userId")).containsOnly((int) f.s2().id());
        long alertId = ((Number) JsonPath.read(own, "$.content[0].id")).longValue();

        // A classmate sees none of it; another department's faculty cannot see or act on it.
        String classmate = send(f.s1(), get("/api/alerts?type=BUNK_DETECTED&size=100"), null).andReturn().getResponse().getContentAsString();
        assertThat(JsonPath.<List<Integer>>read(classmate, "$.content[*].userId")).doesNotContain((int) f.s2().id());
        String foreign = send(otherFaculty, get("/api/alerts?type=BUNK_DETECTED&size=100"), null).andReturn().getResponse().getContentAsString();
        assertThat(JsonPath.<List<Integer>>read(foreign, "$.content[*].userId")).doesNotContain((int) f.s2().id());

        send(f.s2(), post("/api/alerts/" + alertId + "/acknowledge"), null).andExpect(status().isForbidden());
        send(otherFaculty, post("/api/alerts/" + alertId + "/acknowledge"), null).andExpect(status().isForbidden());
        send(f.faculty(), post("/api/alerts/" + alertId + "/acknowledge"), null).andExpect(status().isOk())
                .andExpect(jsonPath("$.acknowledged").value(true));

        send(f.faculty(), get("/api/alerts?acknowledged=false&type=BUNK_DETECTED&size=100"), null)
                .andExpect(jsonPath("$.content[?(@.id==" + alertId + ")]").isEmpty());
        send(admin, post("/api/alerts/999999/acknowledge"), null).andExpect(status().isNotFound());
    }

    @Test
    void anImpossibleJumpRaisesOneAlertThenCoolsDown() throws Exception {
        Fixture f = fixture();
        clock.set(MONDAY.atTime(13, 0, 0));
        ping(f.s1(), ROOM_LAT, ROOM_LNG);
        clock.set(MONDAY.atTime(13, 0, 2));
        ping(f.s1(), FAR_LAT, FAR_LNG);
        clock.set(MONDAY.atTime(13, 0, 4));
        ping(f.s1(), ROOM_LAT, ROOM_LNG);

        List<Alert> mine = alertRepository.findAll().stream()
                .filter(a -> a.getUserId().equals(f.s1().id()) && a.getType() == Alert.AlertType.UNUSUAL_MOVEMENT).toList();
        assertThat(mine).hasSize(1);
        assertThat(mine.get(0).getMessage()).contains("Asha").contains("m/s");
    }

    @Test
    void walkingPaceAndSmallJitterRaiseNoAlert() throws Exception {
        Fixture f = fixture();
        clock.set(MONDAY.atTime(13, 0, 0));
        ping(f.s1(), ROOM_LAT, ROOM_LNG);
        clock.set(MONDAY.atTime(13, 0, 1));
        ping(f.s1(), ROOM_LAT + 0.0002, ROOM_LNG);      // ~22 m in 1 s: jitter below the minimum jump
        clock.set(MONDAY.atTime(13, 2, 0));
        ping(f.s1(), FAR_LAT, FAR_LNG);                  // ~117 m in two minutes: a brisk walk
        assertThat(alertRepository.findAll()).noneSatisfy(a -> {
            assertThat(a.getUserId()).isEqualTo(f.s1().id());
            assertThat(a.getType()).isEqualTo(Alert.AlertType.UNUSUAL_MOVEMENT);
        });
    }

    // ---- crowd monitoring, reports, export ----

    @Test
    void crowdSnapshotCountsPeopleByClassroomWithoutNamingThem() throws Exception {
        Fixture f = fixture();
        Person admin = admin();
        clock.set(MONDAY.atTime(10, 5));
        ping(f.s1(), ROOM_LAT, ROOM_LNG);
        ping(f.s2(), ROOM_LAT, ROOM_LNG);
        ping(f.s3(), HALL_LAT, HALL_LNG);

        String body = send(admin, get("/api/admin/crowd?windowMinutes=10"), null).andExpect(status().isOk())
                .andExpect(jsonPath("$.onCampus").value(greaterThanOrEqualTo(3)))
                .andReturn().getResponse().getContentAsString();
        assertThat(body).doesNotContain("Asha").doesNotContain("Bilal").doesNotContain("email");
        send(admin, get("/api/admin/crowd"), null).andExpect(jsonPath("$.classrooms[?(@.count>=2)]").isNotEmpty());
        send(f.s1(), get("/api/admin/crowd"), null).andExpect(status().isForbidden());

        send(admin, get("/api/admin/reports/footfall?date=" + MONDAY), null).andExpect(status().isOk())
                .andExpect(jsonPath("$.hours.length()").value(24))
                .andExpect(jsonPath("$.peakHour").value(10));
    }

    @Test
    void attendanceReportRanksDepartmentsAndFlagsLowAttendance() throws Exception {
        Fixture f = fixture();
        Person admin = admin();
        clock.set(MONDAY.atTime(10, 5));
        ping(f.s1(), ROOM_LAT, ROOM_LNG);
        clock.set(MONDAY.atTime(11, 6));
        engine.finalizeEnded(clock.time());

        send(admin, get("/api/admin/reports/attendance?from=" + MONDAY + "&to=" + MONDAY + "&departmentId=" + f.departmentId()), null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.departments[0].students").value(3))
                .andExpect(jsonPath("$.departments[0].present").value(1))
                .andExpect(jsonPath("$.departments[0].total").value(3))
                .andExpect(jsonPath("$.belowRequired.length()").value(2));
        send(admin, get("/api/admin/reports/attendance?from=" + MONDAY + "&to=" + MONDAY.minusDays(1)), null).andExpect(status().isBadRequest());
        send(f.s1(), get("/api/admin/reports/attendance"), null).andExpect(status().isForbidden());

        send(f.faculty(), get("/api/faculty/students"), null).andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].belowRequired").value(true));
    }

    @Test
    void csvExportQuotesCellsAndDefusesSpreadsheetFormulas() throws Exception {
        Person admin = admin();
        long dept = createDepartment(admin);
        Person evil = createUser(admin, "=SUM(1,2)", "STUDENT", dept);
        long room = createClassroom(admin, dept, null);
        long sessionId = idOf(createSession(admin, room, dept, null, "10:00", "11:00").andExpect(status().isCreated()));
        clock.set(MONDAY.atTime(10, 5));
        ping(evil, ROOM_LAT, ROOM_LNG);

        String csv = send(admin, get("/api/admin/attendance/export?from=" + MONDAY + "&to=" + MONDAY), null)
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("text/csv"))
                .andReturn().getResponse().getContentAsString();
        assertThat(csv).startsWith("Date,Time,Student,Email,Department,Subject,Classroom,Status,Method,Note");
        // The formula is neutralised with a leading apostrophe, and the comma inside it forces quoting.
        assertThat(csv).contains("\"'=SUM(1,2)\"");
        assertThat(csv).doesNotContain(",=SUM").doesNotContain("\"=SUM");
        assertThat(sessionId).isPositive();

        send(evil, get("/api/admin/attendance/export"), null).andExpect(status().isForbidden());
    }

    @Test
    void adminCanMoveUsersBetweenDepartmentsAndClearThem() throws Exception {
        Fixture f = fixture();
        Person admin = admin();
        long other = createDepartment(admin);
        send(admin, patch("/api/users/" + f.s1().id()), "{\"departmentId\":" + other + "}").andExpect(status().isOk())
                .andExpect(jsonPath("$.departmentId").value(other));
        send(admin, patch("/api/users/" + f.s1().id()), "{\"clearDepartment\":true}").andExpect(status().isOk())
                .andExpect(jsonPath("$.departmentId").doesNotExist());
        send(admin, patch("/api/users/" + f.s1().id()), "{\"departmentId\":999999}").andExpect(status().isBadRequest());
    }

    @Test
    void demotingAHeadClearsTheirHeadship() throws Exception {
        Fixture f = fixture();
        Person admin = admin();
        send(admin, put("/api/admin/departments/" + f.departmentId()),
                "{\"code\":\"HH" + unique() + "\",\"name\":\"Dept\",\"headUserId\":" + f.faculty().id() + "}").andExpect(status().isOk());
        send(admin, patch("/api/users/" + f.faculty().id()), "{\"role\":\"STUDENT\"}").andExpect(status().isOk());
        send(admin, get("/api/admin/departments"), null)
                .andExpect(jsonPath("$[?(@.id==" + f.departmentId() + ")].headUserId").value(hasItem(nullValue())));
    }

    @Test
    void legacyAdminMarkingStillWorksAndCanonicalisesTheClassroomCode() throws Exception {
        Fixture f = fixture();
        Person admin = admin();
        String code = JsonPath.<List<String>>read(send(admin, get("/api/admin/classrooms"), null).andReturn().getResponse().getContentAsString(),
                "$[?(@.id==" + f.classroomId() + ")].code").get(0);
        send(admin, post("/api/attendance/bunk?userId=" + f.s1().id() + "&classroomId=" + code.toLowerCase(Locale.ROOT)), null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.classroomId").value(code))
                .andExpect(jsonPath("$.method").value("MANUAL"))
                .andExpect(jsonPath("$.markedBy").value(admin.id()));
        assertThat(alertRepository.findAll()).anySatisfy(a -> {
            assertThat(a.getUserId()).isEqualTo(f.s1().id());
            assertThat(a.getMessage()).contains("Asha");
        });
    }

    // ---- campus assistant ----

    private ResultActions ask(Person p, String question) throws Exception {
        return send(p, post("/api/assistant"), "{\"message\":\"" + question + "\"}");
    }

    @Test
    void assistantTellsAStudentTheirAttendanceAndHowManyClassesTheyCanMiss() throws Exception {
        Fixture f = fixture();
        clock.set(MONDAY.atTime(10, 5));
        ping(f.s1(), ROOM_LAT, ROOM_LNG);
        ping(f.s2(), HALL_LAT, HALL_LNG);
        clock.set(MONDAY.atTime(11, 6));
        engine.finalizeEnded(clock.time());

        ask(f.s1(), "What is my attendance?").andExpect(status().isOk())
                .andExpect(jsonPath("$.reply").value(containsString("100%")))
                .andExpect(jsonPath("$.suggestions.length()").value(greaterThan(0)));
        // 1 present of 1 class at a 75% requirement: 1/0.75 - 1 = 0.33, so no spare class.
        ask(f.s1(), "How many classes can I miss?").andExpect(jsonPath("$.reply").value(containsString("edge")));
        ask(f.s2(), "can i skip next class").andExpect(jsonPath("$.reply").value(allOf(containsString("below the required"), containsString("next 3 classes"))));
        ask(f.s2(), "my attendance percent").andExpect(jsonPath("$.reply").value(containsString("0%")));
    }

    @Test
    void assistantAnswersAboutTodayAndTheNextClass() throws Exception {
        Fixture f = fixture();
        clock.set(MONDAY.atTime(9, 0));
        ask(f.s1(), "what classes do i have today").andExpect(jsonPath("$.reply").value(allOf(containsString("Data Structures"), containsString("upcoming"))))
                .andExpect(jsonPath("$.link").value("/app/attendance"));
        ask(f.s1(), "when is my next class").andExpect(jsonPath("$.reply").value(allOf(containsString("today at 10:00"), containsString("Prof Rao"))));
        clock.set(MONDAY.atTime(12, 0));
        ask(f.s1(), "next class").andExpect(jsonPath("$.reply").value(containsString("on Monday")));
    }

    @Test
    void assistantListsWhoIsMissingForFacultyAndLowAttendance() throws Exception {
        Fixture f = fixture();
        clock.set(MONDAY.atTime(10, 5));
        ping(f.s1(), ROOM_LAT, ROOM_LNG);
        ping(f.s2(), HALL_LAT, HALL_LNG);
        clock.set(MONDAY.atTime(11, 6));
        engine.finalizeEnded(clock.time());

        ask(f.faculty(), "who is absent in my class?").andExpect(status().isOk())
                .andExpect(jsonPath("$.reply").value(allOf(containsString("1 present"), containsString("Bunked: Bilal"), containsString("Absent: Chitra"))));
        ask(f.faculty(), "students with low attendance").andExpect(jsonPath("$.reply")
                .value(allOf(containsString("2 students are below 75%"), containsString("Bilal"), not(containsString("Asha")))));
    }

    @Test
    void assistantReportsOpenAlertsWithinTheCallersScope() throws Exception {
        Fixture f = fixture();
        clock.set(MONDAY.atTime(13, 0, 0));
        ping(f.s1(), ROOM_LAT, ROOM_LNG);
        clock.set(MONDAY.atTime(13, 0, 2));
        ping(f.s1(), FAR_LAT, FAR_LNG);

        ask(f.s1(), "any alerts about me?").andExpect(jsonPath("$.reply").value(containsString("Asha moved")));
        ask(f.s2(), "any alerts?").andExpect(jsonPath("$.reply").value(not(containsString("Asha"))));
        ask(f.faculty(), "any open alerts?").andExpect(jsonPath("$.reply").value(containsString("Asha moved")));
    }

    @Test
    void assistantFindsPlacesAndKeepsOccupancyAdminOnly() throws Exception {
        Fixture f = fixture();
        Person admin = admin();
        ask(f.s1(), "where is the library?").andExpect(jsonPath("$.reply").value(containsString("Central Library")))
                .andExpect(jsonPath("$.link").value("/app/explore?location=LIB"));
        ask(admin, "where is the library").andExpect(jsonPath("$.link").value("/admin/locations"));
        ask(f.s1(), "how many people are on campus?").andExpect(jsonPath("$.reply").value(containsString("administrators only")));
        clock.set(MONDAY.atTime(10, 5));
        ping(f.s1(), ROOM_LAT, ROOM_LNG);
        ask(admin, "how many people are on campus now").andExpect(jsonPath("$.reply").value(containsString("shared a position")));
    }

    @Test
    void assistantHandlesGreetingsUnknownQuestionsAndBadInput() throws Exception {
        Fixture f = fixture();
        ask(f.s1(), "hello").andExpect(jsonPath("$.reply").value(containsString("campus assistant")));
        ask(f.s1(), "tell me a joke about rockets").andExpect(jsonPath("$.reply").value(containsString("did not catch that")))
                .andExpect(jsonPath("$.suggestions.length()").value(4));
        ask(f.s1(), "").andExpect(status().isBadRequest());
        ask(f.s1(), "x".repeat(301)).andExpect(status().isBadRequest());
        mvc.perform(post("/api/assistant").contentType(MediaType.APPLICATION_JSON).content("{\"message\":\"hi\"}")).andExpect(status().isUnauthorized());
    }
}
