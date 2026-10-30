package com.campus.tracking.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;
import java.time.ZoneId;

/**
 * The campus's wall clock. Timetables are written in campus-local time and stored timestamps are zone-less, so
 * everything that compares them goes through this clock (and the JVM default zone is set to match at startup).
 */
@Configuration
public class ClockConfig {

    @Bean
    public Clock campusClock(@Value("${app.campus.timezone:Asia/Kolkata}") String zone) {
        return Clock.system(ZoneId.of(zone));
    }
}
