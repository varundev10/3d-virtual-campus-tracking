package com.campus.tracking.service;

import com.campus.tracking.model.CampusLocation;
import com.campus.tracking.model.Classroom;
import com.campus.tracking.model.LocationPing;
import com.campus.tracking.repository.CampusLocationRepository;
import com.campus.tracking.repository.ClassroomRepository;
import com.campus.tracking.repository.LocationPingRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.*;

/**
 * Live occupancy: where the people who shared a position recently are right now. Only counts leave this
 * service, never identities, so it is safe to show wherever occupancy (not tracking) is the point.
 */
@Service
public class CrowdService {

    @Autowired
    private LocationPingRepository pingRepository;

    @Autowired
    private CampusLocationRepository campusLocationRepository;

    @Autowired
    private ClassroomRepository classroomRepository;

    @Autowired
    private Clock clock;

    // A person is "at" the nearest place if within this many metres of its marker.
    @Value("${app.crowd.place-radius-meters:60}")
    private double placeRadiusMeters;

    public record PlaceCount(String code, String name, String category, long count) {
    }

    public record RoomCount(String code, String name, String departmentName, Integer capacity, long count) {
    }

    public record Snapshot(LocalDateTime generatedAt, int windowMinutes, long onCampus, long elsewhere,
                           List<PlaceCount> places, List<RoomCount> classrooms) {
    }

    public Snapshot snapshot(int windowMinutes) {
        int window = Math.max(1, Math.min(windowMinutes, 24 * 60));
        LocalDateTime now = LocalDateTime.now(clock);
        List<LocationPing> latest = pingRepository.findLatestPerUserSince(now.minusMinutes(window)).stream()
                .filter(p -> p.getLatitude() != null && p.getLongitude() != null)
                .toList();

        List<CampusLocation> places = campusLocationRepository.findAllByOrderByNameAsc();
        Map<String, Long> perPlace = new HashMap<>();
        long elsewhere = 0;
        for (LocationPing ping : latest) {
            CampusLocation nearest = null;
            double best = Double.MAX_VALUE;
            for (CampusLocation place : places) {
                double d = GeoMath.distanceMeters(place.getLatitude(), place.getLongitude(),
                        ping.getLatitude(), ping.getLongitude());
                if (d < best) {
                    best = d;
                    nearest = place;
                }
            }
            if (nearest != null && best <= placeRadiusMeters) perPlace.merge(nearest.getCode(), 1L, Long::sum);
            else elsewhere++;
        }

        List<PlaceCount> placeCounts = places.stream()
                .map(p -> new PlaceCount(p.getCode(), p.getName(), p.getCategory().name(), perPlace.getOrDefault(p.getCode(), 0L)))
                .sorted(Comparator.comparingLong(PlaceCount::count).reversed().thenComparing(PlaceCount::name))
                .toList();

        List<RoomCount> roomCounts = new ArrayList<>();
        for (Classroom room : classroomRepository.findAllByOrderByCodeAsc()) {
            long inside = latest.stream().filter(p -> AttendanceEngine.insideRoom(room, p)).count();
            roomCounts.add(new RoomCount(room.getCode(), room.getName(),
                    room.getDepartment() == null ? null : room.getDepartment().getName(), room.getCapacity(), inside));
        }

        return new Snapshot(now, window, latest.size(), elsewhere, placeCounts, roomCounts);
    }

    /** Distinct people seen on campus in each hour of a day, indexed 0-23. */
    public long[] footfall(java.time.LocalDate date) {
        long[] perHour = new long[24];
        for (Object[] row : pingRepository.countDistinctUsersPerHour(date.atStartOfDay(), date.plusDays(1).atStartOfDay())) {
            perHour[((Number) row[0]).intValue()] = ((Number) row[1]).longValue();
        }
        return perHour;
    }
}
