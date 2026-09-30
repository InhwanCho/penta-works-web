package com.pentaworks.monitoring.auth;

import java.sql.ResultSet;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.junit.jupiter.api.Assertions.assertThrows;

class PasswordResetServiceTest {
    @AfterEach
    void clearSynchronization() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    @SuppressWarnings("unchecked")
    void expiredUsedOrInactiveResetLinkIsRejectedByTheLookup() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        ResultSet row = mock(ResultSet.class);
        when(row.next()).thenReturn(false);
        when(jdbc.query(anyString(), any(ResultSetExtractor.class), any(Object[].class)))
            .thenAnswer(invocation -> ((ResultSetExtractor<?>) invocation.getArgument(1)).extractData(row));

        assertThrows(com.pentaworks.monitoring.common.NotFoundException.class,
            () -> new PasswordResetService(jdbc, new SecureTokens(), mock(PasswordEncoder.class),
                mock(SessionRegistry.class)).info("expired-or-used"));
        verify(jdbc).query(org.mockito.ArgumentMatchers.argThat(sql ->
                sql.contains("used_at IS NULL") && sql.contains("revoked_at IS NULL") &&
                    sql.contains("expires_at>CURRENT_TIMESTAMP") && sql.contains("c.status='ACTIVE'")),
            any(ResultSetExtractor.class), any(Object[].class));
    }

    @Test
    @SuppressWarnings("unchecked")
    void resetConsumesAllTokensAndInvalidatesSessionsAfterCommit() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        ResultSet row = mock(ResultSet.class);
        when(row.next()).thenReturn(true);
        when(row.getString("id")).thenReturn("reset-id");
        when(row.getLong("user_id")).thenReturn(7L);
        when(row.getLong("company_id")).thenReturn(3L);
        when(row.getString("email")).thenReturn("user@example.com");
        when(row.getString("name")).thenReturn("사용자");
        when(jdbc.query(anyString(), any(ResultSetExtractor.class), any(Object[].class)))
            .thenAnswer(invocation -> ((ResultSetExtractor<?>) invocation.getArgument(1)).extractData(row));
        PasswordEncoder encoder = mock(PasswordEncoder.class);
        when(encoder.encode(anyString())).thenReturn("encoded-password");
        SessionRegistry sessions = mock(SessionRegistry.class);
        TransactionSynchronizationManager.initSynchronization();

        new PasswordResetService(jdbc, new SecureTokens(), encoder, sessions)
            .reset("secret-token", "Valid-password-123!");

        verify(jdbc).update(org.mockito.ArgumentMatchers.contains("UPDATE app_user SET password_hash"),
            eq("encoded-password"), eq(7L));
        verify(jdbc).update(org.mockito.ArgumentMatchers.contains("UPDATE user_session SET revoked_at"), eq(7L));
        verify(jdbc).update(org.mockito.ArgumentMatchers.contains("id<>?"), eq(7L), eq("reset-id"));
        for (TransactionSynchronization synchronization : TransactionSynchronizationManager.getSynchronizations()) {
            synchronization.afterCommit();
        }
        verify(sessions).invalidateUser(7L);
    }
}
