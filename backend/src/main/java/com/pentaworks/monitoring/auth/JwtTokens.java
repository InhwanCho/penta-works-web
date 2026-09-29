package com.pentaworks.monitoring.auth;

import com.pentaworks.monitoring.config.AppProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.Set;
import javax.crypto.SecretKey;
import org.springframework.stereotype.Component;

@Component
public class JwtTokens {
    private static final Set<String> ROLES = Set.of("PLATFORM_ADMIN", "SUPER_ADMIN", "ADMIN", "USER");

    private final SecretKey key;
    private final long accessExpirationMinutes;

    public JwtTokens(AppProperties properties) {
        String secret = properties.jwt().secret();
        if (secret == null || secret.isBlank() || secret.startsWith("change-this-") || secret.startsWith("replace-with-")) {
            throw new IllegalArgumentException("JWT_SECRET must be a random secret of at least 32 bytes");
        }
        key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        accessExpirationMinutes = properties.jwt().accessExpirationMinutes();
        if (accessExpirationMinutes <= 0) throw new IllegalArgumentException("JWT access expiration must be positive");
    }

    public AccessToken issue(long userId, String email, String name, String role, String sessionId) {
        Instant now = Instant.now();
        Instant expiresAt = now.plus(accessExpirationMinutes, ChronoUnit.MINUTES);
        String value = Jwts.builder()
            .subject(Long.toString(userId))
            .claim("email", email)
            .claim("name", name)
            .claim("role", role)
            .claim("sid", sessionId)
            .issuedAt(Date.from(now))
            .expiration(Date.from(expiresAt))
            .signWith(key)
            .compact();
        return new AccessToken(value, expiresAt);
    }

    public Claims verify(String token) {
        Claims claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
        String role = claims.get("role", String.class);
        if (claims.getSubject() == null || claims.getSubject().isBlank()
            || claims.get("email", String.class) == null
            || claims.getExpiration() == null || !ROLES.contains(role)) {
            throw new IllegalArgumentException("Invalid token claims");
        }
        return claims;
    }

    public record AccessToken(String value, Instant expiresAt) {}
}
