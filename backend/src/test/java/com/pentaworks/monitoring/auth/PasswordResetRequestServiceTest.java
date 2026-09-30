package com.pentaworks.monitoring.auth;

import com.pentaworks.monitoring.admin.AccountMailService;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.task.TaskExecutor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.when;

class PasswordResetRequestServiceTest {
    @AfterEach
    void clearSynchronization() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    @SuppressWarnings("unchecked")
    void repeatedRequestWithinOneMinuteStopsBeforeAccountLookup() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        ResultSet rows = mock(ResultSet.class);
        when(rows.next()).thenReturn(true);
        when(rows.getTimestamp(1)).thenReturn(Timestamp.from(Instant.now().minusSeconds(300)));
        when(rows.getTimestamp(2)).thenReturn(Timestamp.from(Instant.now()));
        when(rows.getInt(3)).thenReturn(1);
        when(jdbc.query(anyString(), any(ResultSetExtractor.class), any(Object[].class)))
            .thenAnswer(invocation -> ((ResultSetExtractor<?>) invocation.getArgument(1)).extractData(rows));
        AccountMailService mail = mock(AccountMailService.class);
        TransactionSynchronizationManager.initSynchronization();

        service(jdbc, mail).request("user@example.com");

        verify(jdbc, times(1)).query(anyString(), any(ResultSetExtractor.class), any(Object[].class));
        verify(jdbc, never()).update(org.mockito.ArgumentMatchers.contains("INSERT INTO password_reset_token"),
            any(Object[].class));
        verifyNoInteractions(mail);
    }

    @Test
    @SuppressWarnings("unchecked")
    void unknownEmailHasNoTokenOrMailSideEffect() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        ResultSet rows = mock(ResultSet.class);
        when(rows.next()).thenReturn(true, false);
        when(rows.getTimestamp(1)).thenReturn(Timestamp.from(Instant.now().minusSeconds(120)));
        when(rows.getTimestamp(2)).thenReturn(Timestamp.from(Instant.EPOCH));
        when(rows.getInt(3)).thenReturn(0);
        when(jdbc.query(anyString(), any(ResultSetExtractor.class), any(Object[].class)))
            .thenAnswer(invocation -> ((ResultSetExtractor<?>) invocation.getArgument(1)).extractData(rows));
        when(jdbc.update(anyString(), any(Object[].class))).thenReturn(1);
        AccountMailService mail = mock(AccountMailService.class);
        TransactionSynchronizationManager.initSynchronization();

        service(jdbc, mail).request(" Missing@Example.com ");

        verify(jdbc, never()).update(org.mockito.ArgumentMatchers.contains("INSERT INTO password_reset_token"),
            any(Object[].class));
        verifyNoInteractions(mail);
    }

    @Test
    @SuppressWarnings("unchecked")
    void mailDisabledRevokesGeneratedTokenAfterCommit() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        ResultSet rows = mock(ResultSet.class);
        when(rows.next()).thenReturn(true, true);
        when(rows.getTimestamp(1)).thenReturn(Timestamp.from(Instant.now().minusSeconds(120)));
        when(rows.getTimestamp(2)).thenReturn(Timestamp.from(Instant.EPOCH));
        when(rows.getInt(3)).thenReturn(0);
        when(rows.getLong(1)).thenReturn(7L);
        when(rows.getLong(2)).thenReturn(3L);
        when(rows.getString(3)).thenReturn("user@example.com");
        when(rows.getString(4)).thenReturn("사용자");
        when(jdbc.query(anyString(), any(ResultSetExtractor.class), any(Object[].class)))
            .thenAnswer(invocation -> ((ResultSetExtractor<?>) invocation.getArgument(1)).extractData(rows));
        when(jdbc.update(anyString(), any(Object[].class))).thenReturn(1);
        AccountMailService mail = mock(AccountMailService.class);
        when(mail.sendPasswordReset(anyString(), anyString(), anyString()))
            .thenReturn(AccountMailService.DeliveryStatus.DISABLED);
        TransactionSynchronizationManager.initSynchronization();

        service(jdbc, mail).request("user@example.com");
        for (TransactionSynchronization synchronization : TransactionSynchronizationManager.getSynchronizations()) {
            synchronization.afterCommit();
        }

        verify(mail).sendPasswordReset(anyString(), anyString(), anyString());
        verify(jdbc).update(org.mockito.ArgumentMatchers.contains("UPDATE password_reset_token SET revoked_at"),
            any(Object[].class));
        verify(jdbc).update(org.mockito.ArgumentMatchers.contains("INSERT INTO audit_log"), any(Object[].class));
    }

    private PasswordResetRequestService service(JdbcTemplate jdbc, AccountMailService mail) {
        TaskExecutor directExecutor = Runnable::run;
        PlatformTransactionManager transactions = mock(PlatformTransactionManager.class);
        when(transactions.getTransaction(any())).thenReturn(mock(TransactionStatus.class));
        return new PasswordResetRequestService(jdbc, new SecureTokens(), mail, directExecutor, transactions);
    }
}
