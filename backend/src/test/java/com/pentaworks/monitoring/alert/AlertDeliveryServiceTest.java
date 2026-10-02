package com.pentaworks.monitoring.alert;

import com.pentaworks.monitoring.admin.AuditService;
import com.pentaworks.monitoring.auth.SecureTokens;
import java.sql.ResultSet;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.jdbc.core.RowMapper;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AlertDeliveryServiceTest {
    @Test
    @SuppressWarnings("unchecked")
    void unknownDeliveryDoesNotStartANewAutomaticOrManualBatch() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        ResultSet event = mock(ResultSet.class);
        when(event.next()).thenReturn(true);
        when(event.getString(1)).thenReturn("UNKNOWN");
        when(jdbc.query(anyString(), any(ResultSetExtractor.class), eq(10L)))
            .thenAnswer(invocation -> ((ResultSetExtractor<?>) invocation.getArgument(1)).extractData(event));
        assertNull(service(jdbc).begin(10L, List.of("KAKAO_ALIMTALK:01012345678"), false));
        assertNull(service(jdbc).begin(10L, List.of("KAKAO_ALIMTALK:01012345678"), true));
        verify(jdbc, never()).update(anyString(), any(Object[].class));
    }

    @Test
    @SuppressWarnings("unchecked")
    void retryKeepsPreviousResultsWhenRecipientsAreRemovedOrAdded() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        SecureTokens tokens = new SecureTokens();
        String delivered = "KAKAO_ALIMTALK:01012345678";
        String removed = "KAKAO_ALIMTALK:01022223333";
        String added = "KAKAO_ALIMTALK:01055556666";
        ResultSet event = mock(ResultSet.class);
        when(event.next()).thenReturn(true);
        when(event.getString(1)).thenReturn("PARTIAL");
        when(event.getString(2)).thenReturn("original-batch");
        when(jdbc.query(anyString(), any(ResultSetExtractor.class), eq(10L)))
            .thenAnswer(invocation -> ((ResultSetExtractor<?>) invocation.getArgument(1)).extractData(event));
        when(jdbc.query(anyString(), any(RowMapper.class), eq(10L), eq("original-batch")))
            .thenReturn(List.of(tokens.hash(delivered), tokens.hash(removed)));

        AlertDeliveryService.Batch batch = service(jdbc).begin(10L, List.of(delivered, added), true);

        assertEquals("original-batch", batch.id());
        verify(jdbc, times(1)).update(org.mockito.ArgumentMatchers.contains("INSERT INTO alert_delivery_result"),
            eq(10L), eq("original-batch"), eq(tokens.hash(added)), eq("휴대폰 · ••••6666"), eq("KAKAO_ALIMTALK"));
        verify(jdbc, never()).update(org.mockito.ArgumentMatchers.contains("INSERT INTO alert_delivery_result"),
            eq(10L), anyString(), eq(tokens.hash(delivered)), anyString(), anyString());
        verify(jdbc).update(org.mockito.ArgumentMatchers.contains("AND status='FAILED'"), eq(10L), eq("original-batch"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void beginCreatesOneResultPerDestinationAndClaimIsIdempotent() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        ResultSet event = mock(ResultSet.class);
        when(event.next()).thenReturn(true);
        when(event.getString(1)).thenReturn("PENDING");
        when(event.getString(2)).thenReturn(null);
        when(event.getTimestamp(3)).thenReturn(null);
        when(jdbc.query(anyString(), any(ResultSetExtractor.class), eq(10L)))
            .thenAnswer(invocation -> ((ResultSetExtractor<?>) invocation.getArgument(1)).extractData(event));
        when(jdbc.update(anyString(), any(Object[].class))).thenReturn(1, 1, 1, 1, 0);
        AlertDeliveryService service = service(jdbc);

        AlertDeliveryService.Batch batch = service.begin(10L, List.of("hook-a", "hook-b"), false);

        assertTrue(batch != null);
        assertTrue(service.claim(batch, "hook-a"));
        assertFalse(service.claim(batch, "hook-a"));
        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbc, times(5)).update(sql.capture(), any(Object[].class));
        assertTrue(sql.getAllValues().stream().filter(value -> value.contains("INSERT INTO alert_delivery_result")).count() == 2);
    }

    @Test
    @SuppressWarnings("unchecked")
    void finishPreservesPartialSuccessInsteadOfOverwritingItAsFailure() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), eq(10L), eq("batch")))
            .thenReturn(List.of("SENT", "FAILED"));
        AlertDeliveryService service = service(jdbc);

        service.finish(new AlertDeliveryService.Batch(10L, "batch"));

        verify(jdbc).update(org.mockito.ArgumentMatchers.contains("UPDATE alert_event SET delivery_status"),
            eq("PARTIAL"), any(), eq(true), eq(1), anyString(), eq(10L), eq("batch"));
    }

    @Test
    void interruptedRecoverySeparatesUnsentFromUnknownDestinations() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);

        service(jdbc).recoverInterruptedDeliveries();

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbc, times(3)).update(sql.capture());
        assertTrue(sql.getAllValues().get(0).contains("d.status='PENDING'"));
        assertTrue(sql.getAllValues().get(0).contains("d.status='FAILED'"));
        assertTrue(sql.getAllValues().get(1).contains("d.status='SENDING'"));
        assertTrue(sql.getAllValues().get(1).contains("d.status='UNKNOWN'"));
        assertTrue(sql.getAllValues().get(2).contains("EXISTS"));
    }

    private AlertDeliveryService service(JdbcTemplate jdbc) {
        return new AlertDeliveryService(jdbc, new SecureTokens(), mock(AuditService.class));
    }
}
