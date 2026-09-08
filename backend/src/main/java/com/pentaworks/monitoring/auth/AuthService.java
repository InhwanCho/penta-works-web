package com.pentaworks.monitoring.auth;

import com.pentaworks.monitoring.auth.AuthController.LoginResponse;
import com.pentaworks.monitoring.auth.AuthController.SessionUser;
import com.pentaworks.monitoring.common.UnauthorizedException;
import com.pentaworks.monitoring.config.AppProperties;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import javax.crypto.SecretKey;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class AuthService {
    private final JdbcTemplate jdbcTemplate;
    private final AppProperties properties;

    public AuthService(JdbcTemplate jdbcTemplate, AppProperties properties) {
        this.jdbcTemplate = jdbcTemplate;
        this.properties = properties;
    }

    public LoginResponse login(String username, String password) {
        UserRow user = jdbcTemplate.query(
            "SELECT username, password, role FROM users WHERE username = ?",
            rs -> rs.next() ? new UserRow(rs.getString("username"), rs.getString("password"), rs.getString("role")) : null,
            username.trim());

        if (user == null || !matches(password, user.password())) {
            throw new UnauthorizedException("아이디 또는 비밀번호가 올바르지 않습니다.");
        }

        Instant now = Instant.now();
        String token = Jwts.builder()
            .subject(user.username())
            .claim("role", user.role())
            .issuedAt(java.util.Date.from(now))
            .expiration(java.util.Date.from(now.plus(properties.jwt().expirationMinutes(), ChronoUnit.MINUTES)))
            .signWith(signingKey())
            .compact();
        return new LoginResponse(token, new SessionUser(user.username(), user.role()));
    }

    private boolean matches(String rawPassword, String storedHash) {
        try {
            String sha256 = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest(rawPassword.getBytes(StandardCharsets.UTF_8)));
            return MessageDigest.isEqual(sha256.getBytes(StandardCharsets.UTF_8), storedHash.getBytes(StandardCharsets.UTF_8));
        } catch (Exception error) {
            throw new IllegalStateException("비밀번호를 검증하지 못했습니다.", error);
        }
    }

    private SecretKey signingKey() {
        byte[] source = properties.jwt().secret().getBytes(StandardCharsets.UTF_8);
        byte[] key = new byte[Math.max(32, source.length)];
        System.arraycopy(source, 0, key, 0, Math.min(source.length, key.length));
        return Keys.hmacShaKeyFor(key);
    }

    private record UserRow(String username, String password, String role) {}
}
