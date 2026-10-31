package com.campus.tracking;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.concurrent.atomic.AtomicReference;

/** A clock tests can move, so a whole class session can be played out instantly. */
public class MutableClock extends Clock {

    private final ZoneId zone;
    private final AtomicReference<Instant> now = new AtomicReference<>();

    public MutableClock(ZoneId zone, LocalDateTime start) {
        this.zone = zone;
        set(start);
    }

    public void set(LocalDateTime time) {
        now.set(time.atZone(zone).toInstant());
    }

    public LocalDateTime time() {
        return LocalDateTime.ofInstant(now.get(), zone);
    }

    @Override
    public ZoneId getZone() {
        return zone;
    }

    @Override
    public Clock withZone(ZoneId zone) {
        return new MutableClock(zone, time());
    }

    @Override
    public Instant instant() {
        return now.get();
    }
}
