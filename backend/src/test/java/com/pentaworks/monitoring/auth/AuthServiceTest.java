package com.pentaworks.monitoring.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.ResultSet;
import java.util.HexFormat;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuthServiceTest {
    @Test
    @SuppressWarnings("unchecked")
    void upgradesLegacySha256AfterSuccessfulLogin() throws Exception {
        String rawPassword = "same-password";
        String legacyHash = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
            .digest(rawPassword.getBytes(StandardCharsets.UTF_8)));
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        JwtTokens tokens = mock(JwtTokens.class);
        ResultSet resultSet = mock(ResultSet.class);
        when(resultSet.next()).thenReturn(true);
        when(resultSet.getString("username")).thenReturn("alice");
        when(resultSet.getString("password_hash")).thenReturn(legacyHash);
        when(resultSet.getString("role")).thenReturn("user");
        when(jdbc.query(anyString(), any(ResultSetExtractor.class), any(Object[].class)))
            .thenAnswer(invocation -> ((ResultSetExtractor<?>) invocation.getArgument(1)).extractData(resultSet));
        when(tokens.issue("alice", "user")).thenReturn("jwt");
        var encoder = new BCryptPasswordEncoder(4);

        var response = new AuthService(jdbc, tokens, encoder).login("alice", rawPassword);

        assertEquals("jwt", response.accessToken());
        verify(jdbc).update(contains("UPDATE app_user"), anyString(), eq("alice"), eq(legacyHash));
    }

    @Test
    @SuppressWarnings("unchecked")
    void acceptsBcryptPassword() throws Exception {
        String hash = new BCryptPasswordEncoder(4).encode("same-password");
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        JwtTokens tokens = mock(JwtTokens.class);
        ResultSet resultSet = mock(ResultSet.class);
        when(resultSet.next()).thenReturn(true);
        when(resultSet.getString("username")).thenReturn("alice");
        when(resultSet.getString("password_hash")).thenReturn(hash);
        when(resultSet.getString("role")).thenReturn("user");
        when(jdbc.query(anyString(), any(ResultSetExtractor.class), any(Object[].class)))
            .thenAnswer(invocation -> ((ResultSetExtractor<?>) invocation.getArgument(1)).extractData(resultSet));
        when(tokens.issue("alice", "user")).thenReturn("jwt");

        var response = new AuthService(jdbc, tokens, new BCryptPasswordEncoder(4))
            .login("alice", "same-password");

        assertTrue(response.accessToken().startsWith("jwt"));
    }
}
