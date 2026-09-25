package com.pentaworks.monitoring.auth;

import com.pentaworks.monitoring.auth.AuthController.LoginResponse;
import com.pentaworks.monitoring.auth.AuthController.SessionUser;
import com.pentaworks.monitoring.common.UnauthorizedException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {
    private final JdbcTemplate jdbcTemplate;
    private final JwtTokens tokens;
    private final PasswordEncoder passwordEncoder;

    public AuthService(JdbcTemplate jdbcTemplate, JwtTokens tokens, PasswordEncoder passwordEncoder) {
        this.jdbcTemplate = jdbcTemplate;
        this.tokens = tokens;
        this.passwordEncoder = passwordEncoder;
    }

    public LoginResponse login(String username, String password) {
        UserRow user = jdbcTemplate.query(
            "SELECT username, password_hash, role FROM app_user WHERE username = ? AND status = 'ACTIVE'",
            rs -> rs.next() ? new UserRow(rs.getString("username"), rs.getString("password_hash"), rs.getString("role")) : null,
            username.trim());

        if (user == null || !matches(password, user.password())) {
            throw new UnauthorizedException("아이디 또는 비밀번호가 올바르지 않습니다.");
        }

        upgradeLegacyPassword(user, password);

        String token = tokens.issue(user.username(), user.role());
        return new LoginResponse(token, new SessionUser(user.username(), user.role()));
    }

    private boolean matches(String rawPassword, String storedHash) {
        if (storedHash != null && storedHash.startsWith("$2")) {
            return passwordEncoder.matches(rawPassword, storedHash);
        }
        try {
            String sha256 = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest(rawPassword.getBytes(StandardCharsets.UTF_8)));
            return MessageDigest.isEqual(sha256.getBytes(StandardCharsets.UTF_8), storedHash.getBytes(StandardCharsets.UTF_8));
        } catch (Exception error) {
            throw new IllegalStateException("비밀번호를 검증하지 못했습니다.", error);
        }
    }

    private void upgradeLegacyPassword(UserRow user, String rawPassword) {
        if (user.password() != null && user.password().matches("(?i)^[0-9a-f]{64}$")) {
            jdbcTemplate.update("""
                UPDATE app_user
                SET password_hash=?,password_changed_at=CURRENT_TIMESTAMP(6),updated_at=CURRENT_TIMESTAMP(6)
                WHERE username=? AND password_hash=?
                """, passwordEncoder.encode(rawPassword), user.username(), user.password());
        }
    }

    private record UserRow(String username, String password, String role) {}
}
