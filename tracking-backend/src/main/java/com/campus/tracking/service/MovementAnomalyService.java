package com.campus.tracking.service;

import com.campus.tracking.model.Alert;
import com.campus.tracking.model.LocationPing;
import com.campus.tracking.model.User;
import com.campus.tracking.repository.AlertRepository;
import com.campus.tracking.repository.LocationPingRepository;
import com.campus.tracking.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Locale;
import java.util.Optional;

/**
 * Flags physically implausible jumps between a user's consecutive positions (typically a spoofed GPS, or one
 * account shared between devices). Threshold defaults are well above anything that happens on foot or on a
 * campus road; alerts are rate-limited per user so a single bad stretch does not flood the console.
 */
@Service
public class MovementAnomalyService {

    @Autowired
    private LocationPingRepository pingRepository;

    @Autowired
    private AlertRepository alertRepository;

    @Autowired
    private UserRepository userRepository;

    // 30 m/s is 108 km/h.
    @Value("${app.anomaly.max-speed-mps:30}")
    private double maxSpeedMetersPerSecond;

    // Small jumps are GPS noise whatever the (tiny) time gap says.
    @Value("${app.anomaly.min-jump-meters:100}")
    private double minJumpMeters;

    @Value("${app.anomaly.cooldown-minutes:15}")
    private int cooldownMinutes;

    /** @return the alert raised for this ping, if it was an anomaly. */
    public Optional<Alert> inspect(LocationPing ping) {
        if (ping.getId() == null || ping.getLatitude() == null || ping.getLongitude() == null) return Optional.empty();

        Optional<LocationPing> previous = pingRepository.findFirstByUserIdAndIdLessThanOrderByIdDesc(ping.getUserId(), ping.getId());
        if (previous.isEmpty() || previous.get().getLatitude() == null) return Optional.empty();
        LocationPing before = previous.get();

        double meters = GeoMath.distanceMeters(before.getLatitude(), before.getLongitude(),
                ping.getLatitude(), ping.getLongitude());
        if (meters < minJumpMeters) return Optional.empty();

        double seconds = Math.max(1.0, Duration.between(before.getTimestamp(), ping.getTimestamp()).toMillis() / 1000.0);
        double speed = meters / seconds;
        if (speed <= maxSpeedMetersPerSecond) return Optional.empty();

        if (alertRepository.existsByUserIdAndTypeAndCreatedAtAfter(ping.getUserId(), Alert.AlertType.UNUSUAL_MOVEMENT,
                ping.getTimestamp().minusMinutes(cooldownMinutes))) {
            return Optional.empty();
        }

        String who = userRepository.findById(ping.getUserId()).map(User::getName).orElse("User " + ping.getUserId());
        Alert alert = new Alert();
        alert.setUserId(ping.getUserId());
        alert.setType(Alert.AlertType.UNUSUAL_MOVEMENT);
        alert.setMessage(String.format(Locale.ROOT,
                "%s moved %.0f m in %.0f s (%.0f m/s): possible GPS spoofing or a shared device",
                who, meters, seconds, speed));
        alert.setCreatedAt(ping.getTimestamp());
        return Optional.of(alertRepository.save(alert));
    }
}
