package com.campus.tracking.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * The defaults in application.properties (JWT signing secret, bootstrap admin password) are public in the
 * repository. They are convenient for local development, so this only warns; any shared or deployed instance
 * must override them with APP_JWT_SECRET and APP_ADMIN_PASSWORD.
 */
@Component
public class InsecureDefaultsWarning implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(InsecureDefaultsWarning.class);

    static final String DEFAULT_JWT_SECRET = "campus-tracking-secret-key-32-chars-long-minimum-jwt";
    static final String DEFAULT_ADMIN_PASSWORD = "AdminPass123";

    @Value("${app.jwt.secret:}")
    private String jwtSecret;

    @Value("${app.bootstrap-admin.password:}")
    private String adminPassword;

    @Override
    public void run(ApplicationArguments args) {
        if (DEFAULT_JWT_SECRET.equals(jwtSecret)) {
            log.warn("SECURITY: the JWT signing secret is the public default, so anyone can forge login tokens. "
                    + "Set APP_JWT_SECRET to a long random value on any shared or deployed instance.");
        }
        if (DEFAULT_ADMIN_PASSWORD.equals(adminPassword)) {
            log.warn("SECURITY: the bootstrap admin password is the public default. "
                    + "Set APP_ADMIN_PASSWORD (and APP_ADMIN_EMAIL) on any shared or deployed instance.");
        }
    }
}
