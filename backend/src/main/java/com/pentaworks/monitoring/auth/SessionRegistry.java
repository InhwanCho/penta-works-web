package com.pentaworks.monitoring.auth;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class SessionRegistry {
    private static final Duration CACHE_TTL = Duration.ofSeconds(30);
    private final JdbcTemplate jdbcTemplate;
    private final ConcurrentHashMap<String, CachedSession> cache = new ConcurrentHashMap<>();

    public SessionRegistry(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public boolean isActive(String sessionId, long userId) {
        if (sessionId == null || sessionId.isBlank()) return false;
        Instant now = Instant.now();
        CachedSession cached = cache.get(sessionId);
        if (cached != null && cached.checkedAt().plus(CACHE_TTL).isAfter(now)) {
            return cached.userId() == userId && cached.active();
        }
        Integer count = jdbcTemplate.queryForObject("""
            SELECT COUNT(*) FROM user_session
             WHERE id=? AND user_id=? AND revoked_at IS NULL AND expires_at>CURRENT_TIMESTAMP(6)
            """, Integer.class, sessionId, userId);
        boolean active = count != null && count > 0;
        cache.put(sessionId, new CachedSession(userId, active, now));
        if (cache.size() > 10_000) cache.entrySet().removeIf(entry -> entry.getValue().checkedAt().plus(CACHE_TTL).isBefore(now));
        return active;
    }

    public void invalidate(String sessionId) {
        if (sessionId != null) cache.remove(sessionId);
    }

    public void invalidateUser(long userId) {
        cache.entrySet().removeIf(entry -> entry.getValue().userId() == userId);
    }

    private record CachedSession(long userId, boolean active, Instant checkedAt) {}
}
