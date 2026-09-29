package com.pentaworks.monitoring.auth;

import com.pentaworks.monitoring.auth.AuthController.LoginResponse;
import com.pentaworks.monitoring.auth.AuthController.SessionUser;
import com.pentaworks.monitoring.common.UnauthorizedException;
import com.pentaworks.monitoring.config.AppProperties;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseCookie;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
    private static final int MAX_FAILED_LOGINS = 5;
    private static final Duration LOCK_DURATION = Duration.ofMinutes(15);
    private static final SecureRandom RANDOM = new SecureRandom();

    private final JdbcTemplate jdbcTemplate;
    private final JwtTokens tokens;
    private final PasswordEncoder passwordEncoder;
    private final long refreshExpirationDays;
    private final boolean secureCookie;
    private final SessionRegistry sessions;

    public AuthService(JdbcTemplate jdbcTemplate, JwtTokens tokens, PasswordEncoder passwordEncoder,
                       AppProperties properties, SessionRegistry sessions) {
        this.jdbcTemplate = jdbcTemplate;
        this.tokens = tokens;
        this.passwordEncoder = passwordEncoder;
        refreshExpirationDays = properties.jwt().refreshExpirationDays();
        secureCookie = properties.jwt().secureCookie();
        this.sessions = sessions;
        if (refreshExpirationDays <= 0) throw new IllegalArgumentException("JWT refresh expiration must be positive");
    }

    public AuthResult login(String email, String password, String ipAddress, String userAgent) {
        UserRow user = findUserByEmail(normalizeEmail(email));
        Instant now = Instant.now();
        if (user == null || !"ACTIVE".equals(user.status())) throw invalidCredentials();
        if (user.lockedUntil() != null && user.lockedUntil().isAfter(now)) {
            throw new UnauthorizedException("로그인 시도가 잠시 제한되었습니다. 15분 후 다시 시도해주세요.");
        }
        if (!passwordEncoder.matches(password, user.passwordHash())) {
            registerFailure(user.id());
            throw invalidCredentials();
        }

        jdbcTemplate.update("""
            UPDATE app_user
               SET failed_login_count=0, locked_until=NULL, last_login_at=CURRENT_TIMESTAMP(6),
                   updated_at=CURRENT_TIMESTAMP(6)
             WHERE id=?
            """, user.id());
        return createSession(user, ipAddress, userAgent);
    }

    @Transactional
    public AuthResult refresh(String refreshToken, String ipAddress, String userAgent) {
        if (refreshToken == null || refreshToken.isBlank()) throw expiredSession();
        String oldHash = sha256(refreshToken);
        SessionRow session = jdbcTemplate.query("""
            SELECT s.id AS session_id, u.id, u.company_id, u.email, u.password_hash, u.name, u.role, u.status,
                   u.failed_login_count, u.locked_until
              FROM user_session s
              JOIN app_user u ON u.id = s.user_id
              JOIN company c ON c.id = u.company_id AND c.status='ACTIVE'
             WHERE s.refresh_token_hash=? AND s.revoked_at IS NULL
               AND s.expires_at > CURRENT_TIMESTAMP(6) AND u.status='ACTIVE'
            """, rs -> rs.next() ? new SessionRow(rs.getString("session_id"), userRow(rs)) : null, oldHash);
        if (session == null) throw expiredSession();

        String nextToken = randomToken();
        Instant expiresAt = Instant.now().plus(refreshExpirationDays, ChronoUnit.DAYS);
        int updated = jdbcTemplate.update("""
            UPDATE user_session
               SET refresh_token_hash=?, ip_address=?, device_name=?, last_used_at=CURRENT_TIMESTAMP(6), expires_at=?
             WHERE id=? AND refresh_token_hash=? AND revoked_at IS NULL
            """, sha256(nextToken), trim(ipAddress, 45), trim(userAgent, 120), Timestamp.from(expiresAt),
            session.sessionId(), oldHash);
        if (updated != 1) throw expiredSession();
        return result(session.user(), session.sessionId(), nextToken);
    }

    @Transactional
    public void logout(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) return;
        String sessionId = jdbcTemplate.query("SELECT id FROM user_session WHERE refresh_token_hash=?",
            rs -> rs.next() ? rs.getString(1) : null, sha256(refreshToken));
        jdbcTemplate.update("""
            UPDATE user_session SET revoked_at=CURRENT_TIMESTAMP(6)
             WHERE refresh_token_hash=? AND revoked_at IS NULL
            """, sha256(refreshToken));
        sessions.invalidate(sessionId);
    }

    public List<SessionSummary> sessions(String email, String refreshToken) {
        UserRow user = findUserByEmail(normalizeEmail(email));
        if (user == null) throw expiredSession();
        String currentHash = refreshToken == null || refreshToken.isBlank() ? null : sha256(refreshToken);
        return jdbcTemplate.query("""
            SELECT id,refresh_token_hash,device_name,ip_address,last_used_at,expires_at,created_at
              FROM user_session
             WHERE user_id=? AND revoked_at IS NULL AND expires_at>CURRENT_TIMESTAMP(6)
             ORDER BY last_used_at DESC,created_at DESC
            """, (rs, row) -> new SessionSummary(rs.getString("id"), rs.getString("device_name"),
                rs.getString("ip_address"), rs.getTimestamp("last_used_at").toInstant(),
                rs.getTimestamp("expires_at").toInstant(), rs.getTimestamp("created_at").toInstant(),
                currentHash != null && currentHash.equals(rs.getString("refresh_token_hash"))), user.id());
    }

    @Transactional
    public boolean revokeSession(String email, String sessionId, String refreshToken) {
        UserRow user = findUserByEmail(normalizeEmail(email));
        if (user == null) throw expiredSession();
        String targetHash = jdbcTemplate.query("""
            SELECT refresh_token_hash FROM user_session
             WHERE id=? AND user_id=? AND revoked_at IS NULL
            """, rs -> rs.next() ? rs.getString(1) : null, sessionId, user.id());
        if (targetHash == null) return false;
        jdbcTemplate.update("UPDATE user_session SET revoked_at=CURRENT_TIMESTAMP(6) WHERE id=?", sessionId);
        sessions.invalidate(sessionId);
        return refreshToken != null && targetHash.equals(sha256(refreshToken));
    }

    @Transactional
    public void revokeOtherSessions(String email, String refreshToken) {
        UserRow user = findUserByEmail(normalizeEmail(email));
        if (user == null) throw expiredSession();
        String currentId = refreshToken == null || refreshToken.isBlank() ? null : jdbcTemplate.query("""
            SELECT id FROM user_session WHERE user_id=? AND refresh_token_hash=? AND revoked_at IS NULL
            """, rs -> rs.next() ? rs.getString(1) : null, user.id(), sha256(refreshToken));
        if (currentId == null) throw expiredSession();
        jdbcTemplate.update("""
            UPDATE user_session SET revoked_at=CURRENT_TIMESTAMP(6)
             WHERE user_id=? AND id<>? AND revoked_at IS NULL
            """, user.id(), currentId);
        sessions.invalidateUser(user.id());
    }

    @Transactional
    public void changePassword(String email, String currentPassword, String newPassword) {
        UserRow user = findUserByEmail(normalizeEmail(email));
        if (user == null || !passwordEncoder.matches(currentPassword, user.passwordHash())) {
            throw invalidCredentials();
        }
        InvitationService.validatePassword(newPassword);
        jdbcTemplate.update("""
            UPDATE app_user SET password_hash=?,password_changed_at=CURRENT_TIMESTAMP(6),
                   updated_at=CURRENT_TIMESTAMP(6) WHERE id=?
            """, passwordEncoder.encode(newPassword), user.id());
        jdbcTemplate.update("""
            UPDATE user_session SET revoked_at=CURRENT_TIMESTAMP(6)
             WHERE user_id=? AND revoked_at IS NULL
            """, user.id());
        sessions.invalidateUser(user.id());
        jdbcTemplate.update("""
            INSERT INTO audit_log
                (company_id,actor_user_id,actor_name,action,target_type,target_id,created_at)
            VALUES (?,?,?,'PASSWORD_CHANGED','APP_USER',?,CURRENT_TIMESTAMP(6))
            """, user.companyId(), user.id(), user.name(), Long.toString(user.id()));
    }

    public ResponseCookie refreshCookie(String refreshToken) {
        return ResponseCookie.from(AuthController.REFRESH_COOKIE, refreshToken)
            .httpOnly(true).secure(secureCookie).sameSite("Lax")
            .path("/api/v1/auth").maxAge(Duration.ofDays(refreshExpirationDays)).build();
    }

    public ResponseCookie clearRefreshCookie() {
        return ResponseCookie.from(AuthController.REFRESH_COOKIE, "")
            .httpOnly(true).secure(secureCookie).sameSite("Lax")
            .path("/api/v1/auth").maxAge(Duration.ZERO).build();
    }

    private AuthResult createSession(UserRow user, String ipAddress, String userAgent) {
        String sessionId = UUID.randomUUID().toString();
        String refreshToken = randomToken();
        Instant expiresAt = Instant.now().plus(refreshExpirationDays, ChronoUnit.DAYS);
        jdbcTemplate.update("""
            INSERT INTO user_session
                (id,user_id,refresh_token_hash,device_name,ip_address,last_used_at,expires_at,created_at)
            VALUES (?,?,?,?,?,CURRENT_TIMESTAMP(6),?,CURRENT_TIMESTAMP(6))
            """, sessionId, user.id(), sha256(refreshToken), trim(userAgent, 120), trim(ipAddress, 45),
            Timestamp.from(expiresAt));
        return result(user, sessionId, refreshToken);
    }

    private AuthResult result(UserRow user, String sessionId, String refreshToken) {
        JwtTokens.AccessToken access = tokens.issue(user.id(), user.email(), user.name(), user.role(), sessionId);
        SessionUser sessionUser = new SessionUser(user.id(), user.email(), user.name(), user.role());
        return new AuthResult(new LoginResponse(access.value(), access.expiresAt(), sessionUser), refreshToken);
    }

    private UserRow findUserByEmail(String email) {
        return jdbcTemplate.query("""
            SELECT u.id,u.company_id,u.email,u.password_hash,u.name,u.role,u.status,
                   u.failed_login_count,u.locked_until
              FROM app_user u JOIN company c ON c.id=u.company_id
             WHERE u.email=? AND c.status='ACTIVE'
            """, rs -> rs.next() ? userRow(rs) : null, email);
    }

    private static UserRow userRow(java.sql.ResultSet rs) throws java.sql.SQLException {
        Timestamp locked = rs.getTimestamp("locked_until");
        return new UserRow(rs.getLong("id"), rs.getLong("company_id"), rs.getString("email"), rs.getString("password_hash"),
            rs.getString("name"), rs.getString("role"), rs.getString("status"),
            rs.getInt("failed_login_count"), locked == null ? null : locked.toInstant());
    }

    private void registerFailure(long userId) {
        jdbcTemplate.update("""
            UPDATE app_user
               SET failed_login_count=failed_login_count+1,
                   locked_until=CASE WHEN failed_login_count+1 >= ? THEN ? ELSE locked_until END,
                   updated_at=CURRENT_TIMESTAMP(6)
             WHERE id=?
            """, MAX_FAILED_LOGINS, Timestamp.from(Instant.now().plus(LOCK_DURATION)), userId);
    }

    private static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private static String randomToken() {
        byte[] bytes = new byte[48];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception error) {
            throw new IllegalStateException("세션 토큰을 처리하지 못했습니다.", error);
        }
    }

    private static String trim(String value, int maxLength) {
        if (value == null) return null;
        return value.length() <= maxLength ? value : value.substring(0, maxLength);
    }

    private static UnauthorizedException invalidCredentials() {
        return new UnauthorizedException("이메일 또는 비밀번호가 올바르지 않습니다.");
    }

    private static UnauthorizedException expiredSession() {
        return new UnauthorizedException("로그인이 만료되었습니다. 다시 로그인해주세요.");
    }

    record UserRow(long id, long companyId, String email, String passwordHash, String name, String role, String status,
                   int failedLoginCount, Instant lockedUntil) {}
    private record SessionRow(String sessionId, UserRow user) {}
    public record SessionSummary(String id, String deviceName, String ipAddress, Instant lastUsedAt,
                                 Instant expiresAt, Instant createdAt, boolean current) {}
    public record AuthResult(LoginResponse response, String refreshToken) {}
}
