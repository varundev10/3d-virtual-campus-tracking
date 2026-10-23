package com.campus.tracking_backend;

import com.campus.tracking.TrackingBackendApplication;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

// This package is not under com.campus.tracking, so the application class must be named explicitly.
@SpringBootTest(classes = TrackingBackendApplication.class)
@ActiveProfiles("test")
class TrackingBackendApplicationTests {

	@Test
	void contextLoads() {

	}

}
