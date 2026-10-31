package com.campus.tracking;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.util.TimeZone;

@SpringBootApplication
@EnableScheduling
public class TrackingBackendApplication {
    public static void main(String[] args) {
        // Stored timestamps are zone-less and timetables are written in campus time, so run on campus time
        // rather than the host's zone (UTC on most cloud hosts). Set APP_TIMEZONE to change it.
        String zone = System.getenv("APP_TIMEZONE");
        TimeZone.setDefault(TimeZone.getTimeZone(zone == null || zone.isBlank() ? "Asia/Kolkata" : zone.trim()));
        SpringApplication.run(TrackingBackendApplication.class, args);
    }
}
