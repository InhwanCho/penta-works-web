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

        AuthService service = new AuthService(jdbc, tokens, new BCryptPasswordEncoder(4), properties());
        AuthService.AuthResult result = service.login(" Alice@Example.com ", "same-password", "127.0.0.1", "test");

        assertEquals("jwt", result.response().accessToken());
        assertEquals("alice@example.com", result.response().user().email());
        assertTrue(result.refreshToken().length() >= 64);
        verify(jdbc).query(anyString(), any(ResultSetExtractor.class), eq("alice@example.com"));
    }

    private static AppProperties properties() {
        return new AppProperties(null,
            new AppProperties.Jwt("test-only-random-secret-with-at-least-32-bytes", 43200, 365, false), null, null);
    }
}
