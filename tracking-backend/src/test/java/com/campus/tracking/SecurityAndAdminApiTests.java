package com.campus.tracking;

import com.campus.tracking.model.CampusLocation;
import com.campus.tracking.repository.CampusLocationRepository;
import com.campus.tracking.service.GeofenceService;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SecurityAndAdminApiTests {

    // Inside the campus geofence (UCER_CENTER).
    private static final double IN_LAT = 25.3438271534, IN_LNG = 81.9106717343;

    @Autowired
    private MockMvc mvc;

    @Autowired
    private CampusLocationRepository campusLocationRepository;

    @Autowired
    private GeofenceService geofenceService;

    private record Session(String token, long id) {
        String bearer() {
            return "Bearer " + token;
        }
    }

    private static String uniqueEmail() {
        return "u" + UUID.randomUUID().toString().substring(0, 8) + "@test.local";
    }

    private Session register(String email) throws Exception {
        String body = mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Test Student\",\"email\":\"" + email + "\",\"password\":\"Password123\",\"role\":\"ADMIN\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return new Session(JsonPath.read(body, "$.token"), ((Number) JsonPath.read(body, "$.user.id")).longValue());
    }

    private Session login(String email, String password) throws Exception {
        String body = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return new Session(JsonPath.read(body, "$.token"), ((Number) JsonPath.read(body, "$.user.id")).longValue());
    }

    private Session admin() throws Exception {
        return login("admin@test.local", "AdminPass123");
    }

    private ResultActions getAs(Session s, String url) throws Exception {
        return mvc.perform(get(url).header("Authorization", s.bearer()));
    }

    private ResultActions sendJson(Session s, org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder builder,
                                   String json) throws Exception {
        return mvc.perform(builder.header("Authorization", s.bearer()).contentType(MediaType.APPLICATION_JSON).content(json));
    }

    @Test
    void unauthenticatedRequestsAreRejected() throws Exception {
        mvc.perform(get("/api/users")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/campus-locations")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin/stats")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/users").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"X\",\"email\":\"x@test.local\",\"role\":\"ADMIN\"}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer not-a-real-token"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void registrationIgnoresRequestedRoleAndAlwaysCreatesStudent() throws Exception {
        String email = uniqueEmail();
        Session student = register(email);
        getAs(student, "/api/auth/me")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("STUDENT"))
                .andExpect(jsonPath("$.email").value(email))
                .andExpect(jsonPath("$.passwordHash").doesNotExist());

        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Dup\",\"email\":\"" + email.toUpperCase() + "\",\"password\":\"Password123\"}"))
                .andExpect(status().isConflict());
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"\",\"email\":\"bad\",\"password\":\"short\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.email").exists())
                .andExpect(jsonPath("$.errors.password").exists());
    }

    @Test
    void loginRejectsWrongPassword() throws Exception {
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"admin@test.local\",\"password\":\"wrong-password\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid email or password"));
    }

    @Test
    void studentCannotUseAdminApis() throws Exception {
        Session student = register(uniqueEmail());
        Session adminSession = admin();

        getAs(student, "/api/users").andExpect(status().isForbidden());
        getAs(student, "/api/admin/stats").andExpect(status().isForbidden());
        getAs(student, "/api/admin/pings").andExpect(status().isForbidden());
        getAs(student, "/api/admin/tracking/latest").andExpect(status().isForbidden());
        getAs(student, "/api/users/" + adminSession.id()).andExpect(status().isForbidden());
        getAs(student, "/api/locations/" + adminSession.id() + "/recent").andExpect(status().isForbidden());
        getAs(student, "/api/attendance/" + adminSession.id()).andExpect(status().isForbidden());

        sendJson(student, post("/api/users"), "{\"name\":\"Evil\",\"email\":\"evil@test.local\",\"role\":\"ADMIN\"}")
                .andExpect(status().isForbidden());
        sendJson(student, patch("/api/users/" + student.id()), "{\"role\":\"ADMIN\"}")
                .andExpect(status().isForbidden());
        sendJson(student, put("/api/users/" + adminSession.id() + "/password"), "{\"password\":\"Hijacked123\"}")
                .andExpect(status().isForbidden());
        sendJson(student, post("/api/campus-locations"),
                "{\"code\":\"HACK\",\"name\":\"X\",\"category\":\"LAB\",\"latitude\":25.43,\"longitude\":81.77}")
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/attendance/present").param("userId", String.valueOf(student.id())).param("classroomId", "A-204")
                        .header("Authorization", student.bearer()))
                .andExpect(status().isForbidden());

        // Own records remain accessible.
        getAs(student, "/api/users/" + student.id()).andExpect(status().isOk());
        getAs(student, "/api/attendance/" + student.id()).andExpect(status().isOk());
        getAs(student, "/api/campus-locations").andExpect(status().isOk());
        getAs(student, "/api/auth/me").andExpect(jsonPath("$.role").value("STUDENT"));
    }

    @Test
    void adminCanManageUsersAndDeactivationTakesEffectImmediately() throws Exception {
        Session adminSession = admin();
        String email = uniqueEmail();
        Session student = register(email);

        getAs(adminSession, "/api/users?q=" + email.substring(0, 6)).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].email").value(email));
        getAs(adminSession, "/api/users?role=ADMIN").andExpect(jsonPath("$[*].role", everyItem(is("ADMIN"))));

        sendJson(adminSession, patch("/api/users/" + student.id()), "{\"active\":false}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));
        getAs(student, "/api/auth/me").andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"Password123\"}"))
                .andExpect(status().isForbidden());

        sendJson(adminSession, patch("/api/users/" + student.id()), "{\"active\":true,\"role\":\"FACULTY\"}")
                .andExpect(jsonPath("$.role").value("FACULTY"));
        getAs(student, "/api/auth/me").andExpect(status().isOk()).andExpect(jsonPath("$.role").value("FACULTY"));

        sendJson(adminSession, put("/api/users/" + student.id() + "/password"), "{\"password\":\"ResetPass456\"}")
                .andExpect(status().isNoContent());
        login(email, "ResetPass456");

        // Admin cannot lock themselves out.
        sendJson(adminSession, patch("/api/users/" + adminSession.id()), "{\"active\":false}")
                .andExpect(status().isBadRequest());
        sendJson(adminSession, patch("/api/users/" + adminSession.id()), "{\"role\":\"STUDENT\"}")
                .andExpect(status().isBadRequest());

        // Admin-created user with the original request shape plus a password can sign in.
        String created = uniqueEmail();
        sendJson(adminSession, post("/api/users"),
                "{\"name\":\"New Faculty\",\"email\":\"" + created + "\",\"role\":\"FACULTY\",\"password\":\"Faculty1234\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("FACULTY"));
        login(created, "Faculty1234");
    }

    @Test
    void campusLocationCrudWithValidation() throws Exception {
        Session adminSession = admin();
        String code = "T" + UUID.randomUUID().toString().substring(0, 6).toUpperCase();

        sendJson(adminSession, post("/api/campus-locations"),
                "{\"code\":\"bad code\",\"name\":\"\",\"category\":\"LAB\",\"latitude\":120,\"longitude\":81.77}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.code").exists())
                .andExpect(jsonPath("$.errors.name").exists())
                .andExpect(jsonPath("$.errors.latitude").exists());
        sendJson(adminSession, post("/api/campus-locations"),
                "{\"code\":\"X1\",\"name\":\"X\",\"category\":\"NOT_A_CATEGORY\",\"latitude\":25.43,\"longitude\":81.77}")
                .andExpect(status().isBadRequest());

        String body = sendJson(adminSession, post("/api/campus-locations"),
                "{\"code\":\"" + code + "\",\"name\":\"Central Library Annex\",\"category\":\"LIBRARY\",\"latitude\":25.4304,\"longitude\":81.7703}")
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long id = ((Number) JsonPath.read(body, "$.id")).longValue();

        sendJson(adminSession, post("/api/campus-locations"),
                "{\"code\":\"" + code + "\",\"name\":\"Dup\",\"category\":\"LIBRARY\",\"latitude\":25.43,\"longitude\":81.77}")
                .andExpect(status().isConflict());
        sendJson(adminSession, put("/api/campus-locations/" + id),
                "{\"code\":\"" + code + "\",\"name\":\"Renamed\",\"category\":\"FACILITY\",\"latitude\":25.4304,\"longitude\":81.7703}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Renamed"))
                .andExpect(jsonPath("$.category").value("FACILITY"));
        sendJson(adminSession, put("/api/campus-locations/" + id),
                "{\"code\":\"OTHER-CODE\",\"name\":\"Renamed\",\"category\":\"FACILITY\",\"latitude\":25.4304,\"longitude\":81.7703}")
                .andExpect(status().isBadRequest());

        mvc.perform(delete("/api/campus-locations/" + id).header("Authorization", adminSession.bearer()))
                .andExpect(status().isNoContent());
        getAs(adminSession, "/api/campus-locations/" + id).andExpect(status().isNotFound());
    }

    @Test
    void seededLocationsMatchTheOpenStreetMapLayoutAndLieInsideGeofence() {
        assertThat(campusLocationRepository.findByCodeIgnoreCase("MAIN")).isPresent();
        assertThat(campusLocationRepository.findByCodeIgnoreCase("LIB")).isPresent();
        for (String code : new String[]{"MAIN", "B-BLOCK", "PHARMACY", "LIB", "HOSTEL"}) {
            CampusLocation location = campusLocationRepository.findByCodeIgnoreCase(code).orElseThrow();
            assertThat(geofenceService.isInsideCampus(location.getLatitude(), location.getLongitude()))
                    .as(code + " inside geofence").isTrue();
        }
    }

    @Test
    void locationPingsAreBoundToCallerAndGeofenced() throws Exception {
        Session adminSession = admin();
        Session student = register(uniqueEmail());

        // userId in the body is ignored for non-admins.
        sendJson(student, post("/api/locations"),
                "{\"userId\":" + adminSession.id() + ",\"latitude\":" + IN_LAT + ",\"longitude\":" + IN_LNG + ",\"source\":\"GPS\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(student.id()));

        sendJson(student, post("/api/locations"), "{\"latitude\":28.61,\"longitude\":77.20,\"source\":\"GPS\"}")
                .andExpect(status().isUnprocessableContent());
        sendJson(student, post("/api/locations"), "{\"latitude\":25.43,\"longitude\":81.77,\"source\":\"SATELLITE\"}")
                .andExpect(status().isBadRequest());

        getAs(student, "/api/locations/" + student.id() + "/recent")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)));

        getAs(adminSession, "/api/admin/tracking/latest")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].userId", hasItem((int) student.id())));
        getAs(adminSession, "/api/admin/pings?userId=" + student.id())
                .andExpect(jsonPath("$.totalElements").value(1));
        getAs(adminSession, "/api/admin/stats")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tracking.activeUsers", greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.users.total", greaterThanOrEqualTo(2)))
                .andExpect(jsonPath("$.locations.total", greaterThanOrEqualTo(5)));
        getAs(adminSession, "/api/admin/reports/activity")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pingsPerDay", hasSize(14)))
                .andExpect(jsonPath("$.pingsBySource.GPS", greaterThanOrEqualTo(1)));
        getAs(adminSession, "/api/admin/reports/activity?from=2026-01-10&to=2026-01-01")
                .andExpect(status().isBadRequest());
    }

    @Test
    void attendanceMarkingIsAdminOnly() throws Exception {
        Session adminSession = admin();
        Session student = register(uniqueEmail());

        mvc.perform(post("/api/attendance/bunk").param("userId", String.valueOf(student.id())).param("classroomId", "A-204")
                        .header("Authorization", adminSession.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("BUNKED"));
        getAs(student, "/api/attendance/" + student.id()).andExpect(jsonPath("$", hasSize(1)));
        getAs(adminSession, "/api/admin/alerts").andExpect(jsonPath("$.totalElements", greaterThanOrEqualTo(1)));
        getAs(adminSession, "/api/admin/attendance?status=BUNKED&userId=" + student.id())
                .andExpect(jsonPath("$.totalElements").value(1));
    }

    @Test
    void usersCanUpdateProfileAndChangePassword() throws Exception {
        String email = uniqueEmail();
        Session student = register(email);
        sendJson(student, patch("/api/auth/me"), "{\"name\":\"Renamed Student\"}")
                .andExpect(jsonPath("$.name").value("Renamed Student"))
                .andExpect(jsonPath("$.role").value("STUDENT"));
        sendJson(student, put("/api/auth/password"), "{\"currentPassword\":\"wrong\",\"newPassword\":\"NewPassword1\"}")
                .andExpect(status().isBadRequest());
        sendJson(student, put("/api/auth/password"), "{\"currentPassword\":\"Password123\",\"newPassword\":\"NewPassword1\"}")
                .andExpect(status().isNoContent());
        login(email, "NewPassword1");
    }
}
