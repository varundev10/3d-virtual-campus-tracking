package com.campus.tracking.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;

/**
 * {@code ddl-auto=update} adds columns and tables but never changes an existing CHECK constraint. Hibernate
 * created {@code alerts_type_check} listing only the alert types that existed at the time, which would reject
 * newer types (e.g. UNUSUAL_MOVEMENT) on a database created by an earlier version. Dropping it is idempotent and
 * harmless: the application validates the enum itself, and fresh databases get the full constraint.
 */
@Component
@Order(0)
public class SchemaUpgrade implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(SchemaUpgrade.class);

    @Autowired
    private DataSource dataSource;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        if (!isPostgres()) return;
        try {
            jdbcTemplate.execute("ALTER TABLE IF EXISTS alerts DROP CONSTRAINT IF EXISTS alerts_type_check");
        } catch (RuntimeException e) {
            log.warn("Could not relax the alerts type constraint; new alert types may be rejected: {}", e.getMessage());
        }
    }

    private boolean isPostgres() {
        try (Connection connection = dataSource.getConnection()) {
            return "PostgreSQL".equalsIgnoreCase(connection.getMetaData().getDatabaseProductName());
        } catch (Exception e) {
            return false;
        }
    }
}
