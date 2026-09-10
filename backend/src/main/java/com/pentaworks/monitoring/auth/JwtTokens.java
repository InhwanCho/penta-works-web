package com.pentaworks.monitoring.auth;

import com.pentaworks.monitoring.config.AppProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import javax.crypto.SecretKey;
import org.springframework.stereotype.Component;

@Component
public class JwtTokens {
    private final SecretKey key;
    private final long expirationMinutes;

    public JwtTokens(AppProperties properties) {
        String secret = properties.jwt().secret();
        if (secret == null || secret.isBlank() || secret.startsWith("change-this-") || secret.startsWith("replace-with-")) {
            throw new IllegalArgumentException("JWT_SECRET must be a random secret of at least 32 bytes");
        }
        key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        expirationMinutes = properties.jwt().expirationMinutes();
        if (expirationMinutes <= 0) throw new IllegalArgumentException("JWT expiration must be positive");
    }

    public String issue(String username, String role) {
        Instant now = Instant.now();
        return Jwts.builder().subject(username).claim("role", role).issuedAt(Date.from(now))
            .expiration(Date.from(now.plus(expirationMinutes, ChronoUnit.MINUTES))).signWith(key).compact();
    }

    public Claims verify(String token) {
        Claims claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
        if (claims.getSubject() == null || claims.getSubject().isBlank() || claims.getExpiration() == null
            || !("admin".equals(claims.get("role", String.class)) || "user".equals(claims.get("role", String.class)))) {
            throw new IllegalArgumentException("Invalid token claims");
        }
        return claims;
    }
}
