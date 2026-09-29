package com.pentaworks.monitoring.auth;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SessionRegistryTest {
    @Test
    void cachesActiveSessionAndRechecksAfterInvalidation() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(Integer.class), eq("session"), eq(1L))).thenReturn(1);
        SessionRegistry sessions = new SessionRegistry(jdbc);

        assertTrue(sessions.isActive("session", 1L));
        assertTrue(sessions.isActive("session", 1L));
        verify(jdbc).queryForObject(anyString(), eq(Integer.class), eq("session"), eq(1L));

        sessions.invalidate("session");
        assertTrue(sessions.isActive("session", 1L));
        verify(jdbc, times(2)).queryForObject(anyString(), eq(Integer.class), eq("session"), eq(1L));
    }
}
