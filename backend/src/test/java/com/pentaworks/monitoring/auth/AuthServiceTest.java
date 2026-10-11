package com.pentaworks.monitoring.auth;

import com.pentaworks.monitoring.config.AppProperties;
import java.sql.ResultSet;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuthServiceTest {
    @Test
    @SuppressWarnings("unchecked")
    void logsInByNormalizedEmailAndCreatesPersistentSession() throws Exception {
        String hash = new BCryptPasswordEncoder(4).encode("same-password");
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        JwtTokens tokens = mock(JwtTokens.class);
        ResultSet resultSet = mock(ResultSet.class);
        when(resultSet.next()).thenReturn(true);
        when(resultSet.getLong("id")).thenReturn(7L);
        when(resultSet.getString("email")).thenReturn("alice@example.com");
        when(resultSet.getString("password_hash")).thenReturn(hash);
        when(resultSet.getString("name")).thenReturn("Alice");
        when(resultSet.getString("role")).thenReturn("USER");
        when(resultSet.getString("status")).thenReturn("ACTIVE");
        when(jdbc.query(anyString(), any(ResultSetExtractor.class), any(Object[].class)))
            .thenAnswer(invocation -> ((ResultSetExtractor<?>) invocation.getArgument(1)).extractData(resultSet));
        when(jdbc.update(anyString(), any(Object[].class))).thenReturn(1);
        when(tokens.issue(eq(7L), eq("alice@example.com"), eq("Alice"), eq("USER"), anyString()))
            .thenReturn(new JwtTokens.AccessToken("jwt", Instant.parse("2027-01-01T00:00:00Z")));

        AuthService service = new AuthService(jdbc, tokens, new BCryptPasswordEncoder(4), properties(),
            mock(SessionRegistry.class));
        AuthService.AuthResult result = service.login(" Alice@Example.com ", "same-password", "127.0.0.1", "test");

        assertEquals("jwt", result.response().accessToken());
        assertEquals("alice@example.com", result.response().user().email());
        assertTrue(result.refreshToken().length() >= 64);
        verify(jdbc).query(anyString(), any(ResultSetExtractor.class), eq("alice@example.com"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void logoutRevokesEverySessionOfTheRefreshTokenOwner() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        ResultSet resultSet = mock(ResultSet.class);
        when(resultSet.next()).thenReturn(true);
        when(resultSet.getLong("user_id")).thenReturn(7L);
        when(resultSet.getString("id")).thenReturn("device-id");
        when(jdbc.query(anyString(), any(ResultSetExtractor.class), any(Object[].class)))
            .thenAnswer(invocation -> ((ResultSetExtractor<?>) invocation.getArgument(1)).extractData(resultSet));
        SessionRegistry registry = mock(SessionRegistry.class);
        AuthService service = new AuthService(jdbc, mock(JwtTokens.class), new BCryptPasswordEncoder(4), properties(), registry);
        service.logout("test-refresh-token", true);
        verify(jdbc).update(org.mockito.ArgumentMatchers.contains("WHERE user_id=? AND revoked_at IS NULL"), eq(7L));
        verify(registry).invalidateUser(7L);
    }

    @Test
    @SuppressWarnings("unchecked")
    void profileUpdateChangesOnlyPhoneForTheAuthenticatedAccount() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        ResultSet resultSet = mock(ResultSet.class);
        when(resultSet.next()).thenReturn(true);
        when(resultSet.getLong("id")).thenReturn(7L);
        when(resultSet.getLong("company_id")).thenReturn(1L);
        when(resultSet.getString("email")).thenReturn("alice@example.com");
        when(resultSet.getString("name")).thenReturn("Alice");
        when(jdbc.query(anyString(), any(ResultSetExtractor.class), any(Object[].class)))
            .thenAnswer(invocation -> ((ResultSetExtractor<?>) invocation.getArgument(1)).extractData(resultSet));
        AuthService service = new AuthService(jdbc, mock(JwtTokens.class), new BCryptPasswordEncoder(4), properties(), mock(SessionRegistry.class));
        assertEquals(new AuthService.Profile("alice@example.com", "Alice", "010-1234-5678"),
            service.updateProfile("alice@example.com", " 010-1234-5678 "));
        verify(jdbc).update(org.mockito.ArgumentMatchers.contains("UPDATE app_user SET phone=?,"),
            eq("010-1234-5678"),eq(7L));
    }

    @Test
    void lostRefreshResponseRemainsRecoverableAfterRestartAndLongSleep() throws Exception {
        RefreshFixture fixture = new RefreshFixture();
        String original = "original-device-refresh-token";
        fixture.currentHash = tokenHash(original);
        assertEquals(original, fixture.service().refresh(original, "127.0.0.1", "phone").refreshToken());
        assertEquals(original, fixture.service().refresh(original, "127.0.0.1", "tab").refreshToken());
        assertEquals(tokenHash(original), fixture.currentHash);
        assertEquals(2, fixture.renewals);
    }

    @Test
    void mismatchedTokenCannotRecoverASession() throws Exception {
        RefreshFixture fixture = new RefreshFixture();
        fixture.currentHash = tokenHash("different-token");
        org.junit.jupiter.api.Assertions.assertThrows(com.pentaworks.monitoring.common.UnauthorizedException.class,
            () -> fixture.service().refresh("unrelated-token", "127.0.0.1", "phone"));
        assertEquals(0, fixture.renewals);
    }

    @Test
    @SuppressWarnings("unchecked")
    void defaultLogoutRevokesOnlyCurrentDevice() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        ResultSet rs = mock(ResultSet.class);
        when(rs.next()).thenReturn(true);
        when(rs.getString("id")).thenReturn("this-device");
        when(rs.getLong("user_id")).thenReturn(7L);
        when(jdbc.query(anyString(), any(ResultSetExtractor.class), any(Object[].class)))
            .thenAnswer(call -> ((ResultSetExtractor<?>) call.getArgument(1)).extractData(rs));
        SessionRegistry registry = mock(SessionRegistry.class);
        new AuthService(jdbc, mock(JwtTokens.class), new BCryptPasswordEncoder(4), properties(), registry).logout("device-token");
        verify(jdbc).update(org.mockito.ArgumentMatchers.contains("WHERE id=? AND revoked_at IS NULL"), eq("this-device"));
        verify(registry).invalidate("this-device");
        org.mockito.Mockito.verify(registry, org.mockito.Mockito.never()).invalidateUser(org.mockito.ArgumentMatchers.anyLong());
    }

    @Test
    void revokedExpiredOrMissingSessionCannotBeRefreshed() throws Exception {
        RefreshFixture fixture = new RefreshFixture();
        when(fixture.resultSet.next()).thenReturn(false);
        org.junit.jupiter.api.Assertions.assertThrows(
            com.pentaworks.monitoring.common.UnauthorizedException.class,
            () -> fixture.service().refresh("old-token", "127.0.0.1", "phone"));
        assertEquals(0, fixture.renewals);
    }

    private static String tokenHash(String value) throws Exception {
        return java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256")
            .digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
    }

    private static class RefreshFixture {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final JwtTokens tokens = mock(JwtTokens.class);
        final ResultSet resultSet = mock(ResultSet.class);
        String currentHash;
        int renewals;

        @SuppressWarnings("unchecked")
        RefreshFixture() throws Exception {
            when(resultSet.next()).thenReturn(true);
            when(resultSet.getLong("id")).thenReturn(7L);
            when(resultSet.getString("session_id")).thenReturn("persistent-device-session");
            when(resultSet.getString("email")).thenReturn("alice@example.com");
            when(resultSet.getString("name")).thenReturn("Alice");
            when(resultSet.getString("role")).thenReturn("USER");
            when(resultSet.getString("status")).thenReturn("ACTIVE");
            when(resultSet.getString("refresh_token_hash")).thenAnswer(invocation -> currentHash);
            when(jdbc.query(anyString(), any(ResultSetExtractor.class), any(Object[].class)))
                .thenAnswer(invocation -> ((ResultSetExtractor<?>) invocation.getArgument(1)).extractData(resultSet));
            when(jdbc.update(anyString(), any(Object[].class))).thenAnswer(invocation -> {
                renewals++;
                return 1;
            });
            when(tokens.issue(eq(7L), eq("alice@example.com"), eq("Alice"), eq("USER"), anyString()))
                .thenReturn(new JwtTokens.AccessToken("jwt", Instant.parse("2027-01-01T00:00:00Z")));
        }

        AuthService service() {
            return new AuthService(jdbc, tokens, new BCryptPasswordEncoder(4), properties(), mock(SessionRegistry.class));
        }
    }

    private static AppProperties properties() {
        return new AppProperties(null,
            new AppProperties.Jwt("test-only-random-secret-with-at-least-32-bytes", 43200, 365, false), null, null);
    }
}
