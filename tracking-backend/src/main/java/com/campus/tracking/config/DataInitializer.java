package com.campus.tracking.config;

import com.campus.tracking.model.CampusLocation;
import com.campus.tracking.model.User;
import com.campus.tracking.repository.CampusLocationRepository;
import com.campus.tracking.repository.UserRepository;
import com.campus.tracking.service.UserAccountService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class DataInitializer implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);

    // Mirrors UCER_CENTER in tracking-frontend/src/lib/campus.js, and the 0.45 scale its placeholder scene uses.
    private static final double CENTER_LAT = 25.3438271534;
    private static final double CENTER_LNG = 81.9106717343;
    private static final double METERS_PER_DEGREE = 111_320;
    private static final double SCENE_SCALE = 0.45;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CampusLocationRepository campusLocationRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Value("${app.bootstrap-admin.email:}")
    private String adminEmail;

    @Value("${app.bootstrap-admin.password:}")
    private String adminPassword;

    @Value("${app.bootstrap-admin.name:Campus Administrator}")
    private String adminName;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        bootstrapAdmin();
        seedCampusLocations();
    }

    /**
     * Creates (or promotes) the first admin from environment configuration. Nothing is created
     * when the variables are absent, so no default credentials exist.
     */
    private void bootstrapAdmin() {
        if (adminEmail.isBlank() || adminPassword.isBlank()) {
            if (userRepository.countActiveAdmins() == 0) {
                log.warn("No admin account exists. Set APP_ADMIN_EMAIL and APP_ADMIN_PASSWORD to bootstrap one.");
            }
            return;
        }
        if (adminPassword.length() < 8) {
            log.error("APP_ADMIN_PASSWORD must be at least 8 characters; bootstrap admin was not created.");
            return;
        }

        String email = UserAccountService.normalizeEmail(adminEmail);
        User user = userRepository.findByEmailIgnoreCase(email).orElse(null);
        if (user == null) {
            user = new User();
            user.setName(adminName);
            user.setEmail(email);
        }
        user.setRole(User.Role.ADMIN);
        user.setActive(true);
        // Never overwrite a password the admin has since changed.
        if (!user.getHasPassword()) {
            user.setPasswordHash(passwordEncoder.encode(adminPassword));
        }
        userRepository.save(user);
        log.info("Bootstrap admin account is ready: {}", email);
    }

    /**
     * Seeds the five zones that the original 3D placeholder scene hardcoded (CAMPUS_ZONES),
     * so existing scene labels keep working. Coordinates are the inverse of the scene
     * projection, i.e. approximate positions that should be replaced with surveyed values.
     */
    private void seedCampusLocations() {
        if (campusLocationRepository.count() > 0) return;

        seed("A-BLOCK", "Academic Block A", CampusLocation.Category.ACADEMIC_BLOCK, -34, -18);
        seed("B-BLOCK", "Academic Block B", CampusLocation.Category.ACADEMIC_BLOCK, 16, -24);
        seed("LABS", "Labs Complex", CampusLocation.Category.LAB, -2, 18);
        seed("LIB", "Library", CampusLocation.Category.LIBRARY, 42, 12);
        seed("ADMIN", "Admin Office", CampusLocation.Category.ADMINISTRATION, -44, 26);
        log.info("Seeded campus locations from the existing 3D scene layout");
    }

    private void seed(String code, String name, CampusLocation.Category category, double sceneX, double sceneZ) {
        double metersPerDegreeLng = METERS_PER_DEGREE * Math.cos(Math.toRadians(CENTER_LAT));
        CampusLocation location = new CampusLocation();
        location.setCode(code);
        location.setName(name);
        location.setCategory(category);
        location.setDescription("Approximate position taken from the 3D placeholder layout. Update with surveyed coordinates.");
        location.setLatitude(round(CENTER_LAT - sceneZ / SCENE_SCALE / METERS_PER_DEGREE));
        location.setLongitude(round(CENTER_LNG + sceneX / SCENE_SCALE / metersPerDegreeLng));
        campusLocationRepository.save(location);
    }

    private static double round(double value) {
        return Math.round(value * 1e6) / 1e6;
    }
}
