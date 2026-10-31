package com.campus.tracking.service;

import com.campus.tracking.dto.AcademicViews.AttendanceSummary;
import com.campus.tracking.dto.AcademicViews.Roster;
import com.campus.tracking.dto.AcademicViews.RosterEntry;
import com.campus.tracking.dto.AcademicViews.SubjectSummary;
import com.campus.tracking.model.*;
import com.campus.tracking.repository.*;
import com.campus.tracking.security.AccessScope;
import jakarta.persistence.criteria.Predicate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.*;
import java.time.format.DateTimeFormatter;
import java.time.format.TextStyle;
import java.util.*;
import java.util.stream.Collectors;

/**
 * The campus assistant. It answers from the asker's own role-scoped data (attendance, timetable, alerts, rosters,
 * occupancy, places) with deterministic intent matching, so it needs no external service and never sends student data
 * anywhere. Everything it says is something the signed-in user could already see elsewhere in the app.
 */
@Service
public class AssistantService {

    public record Reply(String reply, List<String> suggestions, String link, String linkLabel) {
        static Reply text(String reply, List<String> suggestions) {
            return new Reply(reply, suggestions, null, null);
        }
    }

    private static final DateTimeFormatter HOUR_MINUTE = DateTimeFormatter.ofPattern("HH:mm");
    private static final int SUMMARY_DAYS = 90;
    private static final int LIST_LIMIT = 6;
    private static final Set<String> STOP_WORDS = Set.of("where", "is", "the", "find", "locate", "how", "do", "get", "to", "a",
            "an", "me", "my", "show", "take", "go", "can", "you", "tell", "about", "which", "what", "directions", "direction",
            "navigate", "building", "room", "please", "i", "of", "in", "at", "for", "near", "from", "campus");

    @Autowired
    private ClassSessionRepository sessionRepository;
    @Autowired
    private AttendanceRecordRepository attendanceRepository;
    @Autowired
    private AlertRepository alertRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private CampusLocationRepository locationRepository;
    @Autowired
    private ClassroomRepository classroomRepository;
    @Autowired
    private AttendanceStats stats;
    @Autowired
    private AttendanceEngine engine;
    @Autowired
    private CrowdService crowdService;
    @Autowired
    private AccessScope scope;
    @Autowired
    private Clock clock;

    public Reply answer(User user, String message) {
        String q = normalize(message);
        List<String> menu = suggestionsFor(user);
        if (q.isBlank()) return help(user, menu);

        boolean staff = user.getRole() != User.Role.STUDENT;
        boolean admin = user.getRole() == User.Role.ADMIN;

        // Whole words only: "hi" must not match "which" or "this".
        Set<String> words = new HashSet<>(Arrays.asList(q.split(" ")));
        if (words.stream().anyMatch(Set.of("hello", "hi", "hey", "help", "namaste")::contains)
                || hasAny(q, "what can you", "good morning", "good evening")) {
            return help(user, menu);
        }
        if (hasAny(q, "crowd", "occupancy", "how many people", "how many students are", "on campus now", "busy", "footfall")) {
            return admin ? occupancy(menu) : Reply.text("Live occupancy is shown to administrators only. I can still tell you about your own classes, attendance and alerts.", menu);
        }
        if (hasAny(q, "alert", "anomal", "unusual", "suspicious", "spoof", "warning")) return alerts(user, menu);
        if (staff && hasAny(q, "low attendance", "below", "shortage", "defaulter", "at risk", "short of")) return lowAttendance(user, menu);
        if (staff && hasAny(q, "absent", "bunk", "missing", "roster", "who is", "who's", "present now", "in class", "attendance now")) return roster(user, menu);
        if (!staff && hasAny(q, "can i miss", "can i skip", "can i bunk", "how many classes can", "afford", "leave", "skip")) return missBudget(user, menu);
        if (!staff && hasAny(q, "attendance", "percent", "%", "75", "eligible", "present", "shortage")) return attendance(user, menu);
        if (hasAny(q, "next class", "next lecture", "what next", "upcoming")) return nextClass(user, menu);
        if (hasAny(q, "today", "schedule", "timetable", "classes", "lecture", "what do i have", "tomorrow")) return today(user, menu);
        if (staff && hasAny(q, "attendance")) return roster(user, menu);

        Optional<Reply> place = place(user, q);
        if (place.isPresent()) return place.get();

        return Reply.text("I did not catch that. I can help with your classes and timetable, attendance, alerts and finding places on campus. Try one of these:", menu);
    }

    // ---- Intents ----

    private Reply help(User user, List<String> menu) {
        String what = switch (user.getRole()) {
            case STUDENT -> "your timetable, your attendance (and how many classes you can still miss), alerts about you, and where things are on campus";
            case FACULTY -> "your classes today, who is present or missing in a class, students with low attendance, department alerts, and where things are on campus";
            case ADMIN -> "live campus occupancy, open alerts, low attendance across departments, and where things are on campus";
        };
        return Reply.text("Hi " + firstName(user) + "! I am the campus assistant. I can help with " + what + ".", menu);
    }

    private Reply attendance(User user, List<String> menu) {
        AttendanceSummary s = stats.summary(user.getId(), today().minusDays(SUMMARY_DAYS - 1L), today());
        if (s.total() == 0) {
            String dept = user.getDepartment() == null ? " You are not in a department yet, so no timetable is tracked. Ask administration to assign yours." : "";
            return Reply.text("No timetabled classes have been recorded for you in the last " + SUMMARY_DAYS + " days." + dept, menu);
        }
        StringBuilder sb = new StringBuilder(String.format(Locale.ROOT, "Your attendance over the last %d days is %s%% (%d present of %d classes; %d absent, %d bunked).",
                SUMMARY_DAYS, pct(s.overallPercent()), s.present(), s.total(), s.absent(), s.bunked()));
        subjects(s).stream().min(Comparator.comparingDouble(SubjectSummary::percent)).filter(w -> w.percent() < 100).ifPresent(w -> sb.append(String.format(Locale.ROOT,
                "%nWeakest subject: %s at %s%%.", w.subject(), pct(w.percent()))));
        double r = stats.requiredPercent();
        if (s.overallPercent() < r) {
            sb.append(String.format(Locale.ROOT, "%nYou are below the required %s%%. Attending the next %d classes in a row would bring you back.",
                    pct(r), classesToRecover(s.present(), s.total(), r)));
        } else {
            sb.append(String.format(Locale.ROOT, "%nThat meets the required %s%%.", pct(r)));
        }
        return Reply.text(sb.toString(), menu);
    }

    private Reply missBudget(User user, List<String> menu) {
        AttendanceSummary s = stats.summary(user.getId(), today().minusDays(SUMMARY_DAYS - 1L), today());
        double r = stats.requiredPercent();
        if (s.total() == 0) return Reply.text("There is no attendance history yet, so I cannot work that out. Attend your first classes and ask again.", menu);
        if (s.overallPercent() < r) {
            return Reply.text(String.format(Locale.ROOT, "Not right now: you are at %s%%, below the required %s%%. You need to attend the next %d classes in a row to recover. Please do not skip.",
                    pct(s.overallPercent()), pct(r), classesToRecover(s.present(), s.total(), r)), menu);
        }
        long spare = (long) Math.floor(s.present() / (r / 100.0) - s.total());
        return Reply.text(spare <= 0
                ? String.format(Locale.ROOT, "You are at %s%%, right at the edge of the required %s%%. Missing even one class would drop you below it.", pct(s.overallPercent()), pct(r))
                : String.format(Locale.ROOT, "You are at %s%%. You could miss up to %d more class%s and still stay at or above %s%%, but a skipped class that is detected counts as a bunk and raises an alert.",
                pct(s.overallPercent()), spare, spare == 1 ? "" : "es", pct(r)), menu);
    }

    private Reply today(User user, List<String> menu) {
        LocalDate today = today();
        List<ClassSession> sessions = mySessions(user).stream()
                .filter(s -> s.isActiveSlot() && s.getDayOfWeek() == today.getDayOfWeek())
                .sorted(Comparator.comparing(ClassSession::getStartTime)).toList();
        if (sessions.isEmpty()) {
            return Reply.text(user.getRole() == User.Role.ADMIN
                    ? "Administrators do not have a personal timetable. Open Academics to see every department's classes."
                    : "You have no classes today (" + today.getDayOfWeek().getDisplayName(TextStyle.FULL, Locale.ENGLISH) + ").", menu);
        }
        Map<Long, AttendanceRecord> marked = attendanceRepository
                .findByUserIdInAndSessionDateBetween(List.of(user.getId()), today, today).stream()
                .collect(Collectors.toMap(AttendanceRecord::getSessionId, r -> r, (a, b) -> a));
        LocalTime now = LocalTime.now(clock);
        StringBuilder sb = new StringBuilder("Today's classes:");
        for (ClassSession s : sessions) {
            String state = now.isBefore(s.getStartTime()) ? "upcoming" : now.isAfter(s.getEndTime()) ? "finished" : "in progress";
            AttendanceRecord r = marked.get(s.getId());
            sb.append(String.format("%n• %s–%s %s (%s), %s", s.getStartTime().format(HOUR_MINUTE), s.getEndTime().format(HOUR_MINUTE),
                    s.getSubject(), s.getClassroom().getCode(), r != null ? r.getStatus().name().toLowerCase(Locale.ROOT) : state));
        }
        return new Reply(sb.toString(), menu, user.getRole() == User.Role.FACULTY ? "/app/teaching" : "/app/attendance", "Open timetable");
    }

    private Reply nextClass(User user, List<String> menu) {
        LocalDateTime now = LocalDateTime.now(clock);
        List<ClassSession> mine = mySessions(user).stream().filter(ClassSession::isActiveSlot).toList();
        for (int offset = 0; offset < 8; offset++) {
            LocalDate day = now.toLocalDate().plusDays(offset);
            final int dayOffset = offset;
            Optional<ClassSession> next = mine.stream()
                    .filter(s -> s.getDayOfWeek() == day.getDayOfWeek())
                    .filter(s -> dayOffset > 0 || s.getStartTime().isAfter(now.toLocalTime()))
                    .min(Comparator.comparing(ClassSession::getStartTime));
            if (next.isPresent()) {
                ClassSession s = next.get();
                String when = offset == 0 ? "today" : offset == 1 ? "tomorrow" : "on " + day.getDayOfWeek().getDisplayName(TextStyle.FULL, Locale.ENGLISH);
                return Reply.text(String.format("Your next class is %s %s at %s in %s%s.", s.getSubject(), when, s.getStartTime().format(HOUR_MINUTE),
                        s.getClassroom().getCode(), s.getFaculty() != null && user.getRole() == User.Role.STUDENT ? " with " + s.getFaculty().getName() : ""), menu);
            }
        }
        return Reply.text("I cannot find an upcoming class for you in the next week.", menu);
    }

    private Reply alerts(User user, List<String> menu) {
        Set<Long> visible = scope.visibleUserIds(user);
        var spec = (org.springframework.data.jpa.domain.Specification<Alert>) (root, query, cb) -> {
            List<Predicate> p = new ArrayList<>();
            if (visible != null) p.add(root.get("userId").in(visible));
            p.add(cb.or(cb.isNull(root.get("acknowledged")), cb.isFalse(root.get("acknowledged"))));
            return cb.and(p.toArray(new Predicate[0]));
        };
        var page = alertRepository.findAll(spec, PageRequest.of(0, 3, Sort.by(Sort.Direction.DESC, "createdAt")));
        if (page.getTotalElements() == 0) return Reply.text("No open alerts. Everything raised so far has been acknowledged.", menu);
        StringBuilder sb = new StringBuilder(page.getTotalElements() + " open alert" + (page.getTotalElements() == 1 ? "" : "s") + ". Latest:");
        page.getContent().forEach(a -> sb.append("\n• ").append(a.getMessage()));
        String link = user.getRole() == User.Role.ADMIN ? "/admin/reports" : user.getRole() == User.Role.FACULTY ? "/app/department" : "/app/attendance";
        return new Reply(sb.toString(), menu, link, "Open alerts");
    }

    private Reply roster(User user, List<String> menu) {
        LocalDateTime now = LocalDateTime.now(clock);
        List<ClassSession> today = (user.getRole() == User.Role.ADMIN ? sessionRepository.findAllByOrderByDayOfWeekAscStartTimeAsc() : mySessions(user)).stream()
                .filter(s -> s.isActiveSlot() && s.getDayOfWeek() == now.getDayOfWeek()).sorted(Comparator.comparing(ClassSession::getStartTime)).toList();
        if (today.isEmpty()) return Reply.text("There are no classes today to report on.", menu);

        // The class in progress, else the last one that finished, else the first still to come.
        LocalTime t = now.toLocalTime();
        ClassSession pick = today.stream().filter(s -> !t.isBefore(s.getStartTime()) && !t.isAfter(s.getEndTime())).findFirst()
                .orElseGet(() -> today.stream().filter(s -> t.isAfter(s.getEndTime())).reduce((a, b) -> b).orElse(today.get(0)));
        Roster r = engine.roster(pick, now.toLocalDate());
        Map<AttendanceRecord.Status, List<String>> by = new EnumMap<>(AttendanceRecord.Status.class);
        List<String> pending = new ArrayList<>();
        for (RosterEntry e : r.entries()) {
            if (e.status() == null) pending.add(e.name());
            else by.computeIfAbsent(e.status(), k -> new ArrayList<>()).add(e.name());
        }
        StringBuilder sb = new StringBuilder(String.format("%s (%s, %s–%s): %d present, %d absent, %d bunked, %d pending of %d.", pick.getSubject(),
                pick.getClassroom().getCode(), pick.getStartTime().format(HOUR_MINUTE), pick.getEndTime().format(HOUR_MINUTE),
                by.getOrDefault(AttendanceRecord.Status.PRESENT, List.of()).size(), by.getOrDefault(AttendanceRecord.Status.ABSENT, List.of()).size(),
                by.getOrDefault(AttendanceRecord.Status.BUNKED, List.of()).size(), pending.size(), r.entries().size()));
        appendNames(sb, "Bunked", by.get(AttendanceRecord.Status.BUNKED));
        appendNames(sb, "Absent", by.get(AttendanceRecord.Status.ABSENT));
        appendNames(sb, "Not yet marked", pending);
        return new Reply(sb.toString(), menu, user.getRole() == User.Role.FACULTY ? "/app/teaching" : "/admin/academics", "Open roster");
    }

    private Reply lowAttendance(User user, List<String> menu) {
        List<User> students = user.getRole() == User.Role.ADMIN
                ? userRepository.findAll().stream().filter(u -> u.getRole() == User.Role.STUDENT && u.getActive()).toList()
                : user.getDepartment() == null ? List.of()
                : userRepository.findActiveByDepartmentAndRole(user.getDepartment().getId(), User.Role.STUDENT);
        LocalDate today = today();
        Map<Long, AttendanceSummary> sums = stats.summaries(students.stream().map(User::getId).toList(), today.minusDays(29), today);
        List<User> low = students.stream().filter(u -> sums.get(u.getId()).total() > 0 && sums.get(u.getId()).overallPercent() < stats.requiredPercent())
                .sorted(Comparator.comparingDouble(u -> sums.get(u.getId()).overallPercent())).toList();
        if (low.isEmpty()) return Reply.text(String.format(Locale.ROOT, "Nobody is below the required %s%% over the last 30 days.", pct(stats.requiredPercent())), menu);
        StringBuilder sb = new StringBuilder(String.format(Locale.ROOT, "%d student%s below %s%% over the last 30 days:", low.size(), low.size() == 1 ? " is" : "s are", pct(stats.requiredPercent())));
        low.stream().limit(LIST_LIMIT).forEach(u -> sb.append(String.format(Locale.ROOT, "%n• %s: %s%% (%d classes)", u.getName(), pct(sums.get(u.getId()).overallPercent()), sums.get(u.getId()).total())));
        if (low.size() > LIST_LIMIT) sb.append("\n…and ").append(low.size() - LIST_LIMIT).append(" more.");
        return new Reply(sb.toString(), menu, user.getRole() == User.Role.ADMIN ? "/admin/reports" : "/app/department", "Open the full list");
    }

    private Reply occupancy(List<String> menu) {
        CrowdService.Snapshot s = crowdService.snapshot(10);
        if (s.onCampus() == 0) return Reply.text("Nobody has shared a position in the last " + s.windowMinutes() + " minutes.", menu);
        StringBuilder sb = new StringBuilder(s.onCampus() + " " + (s.onCampus() == 1 ? "person has" : "people have") + " shared a position in the last " + s.windowMinutes() + " minutes.");
        s.places().stream().filter(p -> p.count() > 0).limit(3).forEach(p -> sb.append("\n• ").append(p.name()).append(": ").append(p.count()));
        s.classrooms().stream().filter(c -> c.count() > 0).limit(3).forEach(c -> sb.append("\n• Classroom ").append(c.code()).append(": ").append(c.count()).append(c.capacity() != null ? " of " + c.capacity() : ""));
        return new Reply(sb.toString(), menu, "/admin", "Open overview");
    }

    private Optional<Reply> place(User user, String q) {
        List<String> tokens = Arrays.stream(q.split(" ")).filter(w -> w.length() >= 3 && !STOP_WORDS.contains(w)).toList();
        if (tokens.isEmpty()) return Optional.empty();

        for (CampusLocation l : locationRepository.findAllByOrderByNameAsc()) {
            String hay = (l.getName() + " " + l.getCode()).toLowerCase(Locale.ROOT).replace('-', ' ');
            if (tokens.stream().anyMatch(hay::contains)) {
                String where = String.format(Locale.ROOT, "%s is a %s on campus (%.5f, %.5f).", l.getName(), l.getCategory().name().toLowerCase(Locale.ROOT).replace('_', ' '), l.getLatitude(), l.getLongitude());
                boolean admin = user.getRole() == User.Role.ADMIN;
                return Optional.of(new Reply(where + (admin ? "" : " Open it in the 3D explorer for directions from where you are."), suggestionsFor(user),
                        admin ? "/admin/locations" : "/app/explore?location=" + l.getCode(), admin ? "Open locations" : "Show on the map"));
            }
        }
        for (Classroom c : classroomRepository.findAllByOrderByCodeAsc()) {
            String hay = (c.getCode() + " " + c.getName()).toLowerCase(Locale.ROOT).replace('-', ' ');
            if (tokens.stream().anyMatch(hay::contains)) {
                return Optional.of(Reply.text(c.getName() + " (" + c.getCode() + ")" + (c.getLocationCode() != null ? " is in the " + c.getLocationCode() + " building" : " is on campus")
                        + (c.getFloorLevel() != null ? ", floor " + c.getFloorLevel() : "") + (c.getDepartment() != null ? ", used by " + c.getDepartment().getName() : "") + ".", suggestionsFor(user)));
            }
        }
        return Optional.empty();
    }

    // ---- Helpers ----

    private List<ClassSession> mySessions(User user) {
        if (user.getRole() == User.Role.STUDENT) {
            return user.getDepartment() == null ? List.of()
                    : sessionRepository.findByDepartmentIdOrderByDayOfWeekAscStartTimeAsc(user.getDepartment().getId());
        }
        if (user.getRole() == User.Role.FACULTY) {
            List<Long> headed = AccessScope.heads(user, user.getDepartment()) ? List.of(user.getDepartment().getId()) : List.of(-1L);
            return sessionRepository.findTaughtByOrInDepartments(user.getId(), headed);
        }
        return List.of();
    }

    private List<String> suggestionsFor(User user) {
        return switch (user.getRole()) {
            case STUDENT -> List.of("What are my classes today?", "What is my attendance?", "How many classes can I miss?", "Where is the library?");
            case FACULTY -> List.of("Who is absent in my class?", "Students with low attendance", "What are my classes today?", "Any open alerts?");
            case ADMIN -> List.of("How many people are on campus?", "Any open alerts?", "Students with low attendance", "Where is the library?");
        };
    }

    private static void appendNames(StringBuilder sb, String label, List<String> names) {
        if (names == null || names.isEmpty()) return;
        sb.append("\n").append(label).append(": ").append(String.join(", ", names.stream().limit(LIST_LIMIT).toList()));
        if (names.size() > LIST_LIMIT) sb.append(" and ").append(names.size() - LIST_LIMIT).append(" more");
        sb.append('.');
    }

    private static List<SubjectSummary> subjects(AttendanceSummary s) {
        return s.subjects().stream().filter(x -> x.total() > 0).toList();
    }

    /** Consecutive attended classes needed to reach {@code requiredPercent}. */
    static long classesToRecover(long present, long total, double requiredPercent) {
        double r = requiredPercent / 100.0;
        if (r >= 1.0) return 0;
        return Math.max(1, (long) Math.ceil((r * total - present) / (1 - r)));
    }

    private LocalDate today() {
        return LocalDate.now(clock);
    }

    private static String pct(double value) {
        return value == Math.rint(value) ? String.valueOf((long) value) : String.format(Locale.ROOT, "%.1f", value);
    }

    private static String firstName(User user) {
        return user.getName().trim().split("\\s+")[0];
    }

    private static String normalize(String message) {
        return message == null ? "" : message.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9%' ]+", " ").replaceAll("\\s+", " ").trim();
    }

    private static boolean hasAny(String q, String... needles) {
        for (String n : needles) if (q.contains(n)) return true;
        return false;
    }
}
