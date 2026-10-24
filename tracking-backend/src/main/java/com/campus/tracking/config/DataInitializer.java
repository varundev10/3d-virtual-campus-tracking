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
     * Seeds the campus's real places into an empty table. The list mirrors
     * tracking-frontend/src/lib/campus-buildings.js (keep the two in step: the explorer list comes from here, the
     * login map and tests from there). Positions are the centres of the OpenStreetMap outlines
     * (© OpenStreetMap contributors, ODbL); the list is provisional until the full layout is available. An existing
     * database keeps whatever rows it already has.
     */
    private void seedCampusLocations() {
        if (campusLocationRepository.count() > 0) return;

        seed("MAIN", "Main Building", CampusLocation.Category.ADMINISTRATION, 25.343626, 81.910828);
        seed("B-BLOCK", "Block B", CampusLocation.Category.ACADEMIC_BLOCK, 25.343893, 81.91133);
        seed("PHARMACY", "Pharmacy", CampusLocation.Category.DEPARTMENT, 25.344132, 81.911873);
        seed("LIB", "Central Library", CampusLocation.Category.LIBRARY, 25.344102, 81.910451);
        seed("HOSTEL", "Hostel (Boys + Girls)", CampusLocation.Category.HOSTEL, 25.343345, 81.91004);
        log.info("Seeded campus locations from the OpenStreetMap layout");
    }

    private void seed(String code, String name, CampusLocation.Category category, double latitude, double longitude) {
        CampusLocation location = new CampusLocation();
        location.setCode(code);
        location.setName(name);
        location.setCategory(category);
        location.setDescription("Position from OpenStreetMap (© OpenStreetMap contributors, ODbL); approximate. Update with surveyed coordinates.");
        location.setLatitude(latitude);
        location.setLongitude(longitude);
        campusLocationRepository.save(location);
    }
}
