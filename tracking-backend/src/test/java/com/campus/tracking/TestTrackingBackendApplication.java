package com.campus.tracking;

import org.springframework.boot.SpringApplication;

/**
 * Runs the backend against an in-memory H2 database with the "test" profile, for trying the
 * app without MySQL: {@code ./mvnw spring-boot:test-run}. Data is lost on shutdown.
 */
public class TestTrackingBackendApplication {
    public static void main(String[] args) {
        SpringApplication.from(TrackingBackendApplication::main)
                .withAdditionalProfiles("test")
                .run(args);
    }
}
