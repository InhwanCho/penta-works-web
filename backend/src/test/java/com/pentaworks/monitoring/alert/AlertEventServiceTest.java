package com.pentaworks.monitoring.alert;

import com.pentaworks.monitoring.admin.AuditService;
import com.pentaworks.monitoring.auth.CurrentUserService;
import java.sql.ResultSet;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class AlertEventServiceTest {
    @Test
    @SuppressWarnings("unchecked")
    void collectionAlertStartsAtSecondMissAndClosesWhenDataReturns() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(Long.class), eq("001"))).thenReturn(7L);
        when(jdbc.queryForObject(eq("SELECT LAST_INSERT_ID()"), eq(Long.class))).thenReturn(9L);
        ResultSet rs = mock(ResultSet.class);
        when(rs.next()).thenReturn(false, false, true);
        when(rs.getLong("id")).thenReturn(9L);
        when(jdbc.query(anyString(), any(ResultSetExtractor.class), eq(7L), eq("NO_DATA")))
            .thenAnswer(invocation -> ((ResultSetExtractor<?>) invocation.getArgument(1)).extractData(rs));
        var service = new AlertEventService(jdbc, mock(CurrentUserService.class), mock(AuditService.class));
        var site = new SiteAlertSettings("001", "병원", true, List.of(), 20, true, true, 0, 30,
            null, null, false, List.of(), true, false, 10, 2);
        assertNull(service.evaluateNoData(site, 19L));
        var transition = service.evaluateNoData(site, 20L);
        assertEquals(9L, transition.eventId());
        assertEquals("NO_DATA", transition.eventType());
        org.junit.jupiter.api.Assertions.assertTrue(transition.message().contains("2회 연속 누락"));
        assertNull(service.evaluateNoData(site, 0L));
        verify(jdbc).update(eq("UPDATE alert_event SET recovered_at=? WHERE id=?"), any(java.sql.Timestamp.class), eq(9L));
    }
    @Test
    void coldChillerIgnoresUnmeasuredAndDisabledValues() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        var service = new AlertEventService(jdbc, mock(CurrentUserService.class), mock(AuditService.class));
        var site = new SiteAlertSettings("001", "병원", true, List.of(), 30, false, true, 0, 30,
            null, null, false, List.of(), true, true);
        for (double value : new double[]{0, 0.001, 0.01, 0.1, -0.1, -3258.2, Double.NaN, Double.POSITIVE_INFINITY}) {
            assertNull(service.evaluateColdChiller(site, value, value));
        }
        assertNull(service.evaluateColdChiller(site, null, 20.0));
        var disabled = new SiteAlertSettings("001", "병원", true, List.of(), 30, false, true, 0, 30, null, null, false);
        assertNull(service.evaluateColdChiller(disabled, 20.5, 20.5));
        verifyNoInteractions(jdbc);
    }

    @Test
    @SuppressWarnings("unchecked")
    void coldChillerCreatesNewIncidentWhenEqual() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(Long.class), eq("001"), eq("__cold_chiller__"))).thenReturn(7L);
        when(jdbc.queryForObject(eq("SELECT LAST_INSERT_ID()"), eq(Long.class))).thenReturn(9L);
        when(jdbc.query(anyString(), any(ResultSetExtractor.class), eq(7L), eq("LOW"), eq("HIGH")))
            .thenAnswer(invocation -> ((ResultSetExtractor<?>) invocation.getArgument(1)).extractData(mock(ResultSet.class)));
        var service = new AlertEventService(jdbc, mock(CurrentUserService.class), mock(AuditService.class));
        var site = new SiteAlertSettings("001", "병원", true, List.of(), 30, false, true, 0, 30,
            null, null, false, List.of(), true, true);
        assertEquals(9L, service.evaluateColdChiller(site, 20.123, 20.123).eventId());
        verify(jdbc).queryForObject(eq("SELECT LAST_INSERT_ID()"), eq(Long.class));
    }

    @Test
    @SuppressWarnings("unchecked")
    void coldChillerExactEqualityRepeatsSameIncidentAndDifferentValuesCloseIt() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(Long.class), eq("001"), eq("__cold_chiller__"))).thenReturn(7L);
        ResultSet rs = mock(ResultSet.class);
        when(rs.next()).thenReturn(true);
        when(rs.getLong("id")).thenReturn(5L);
        when(rs.getString("event_type")).thenReturn("HIGH");
        when(rs.getString("delivery_status")).thenReturn("SKIPPED");
        when(jdbc.query(anyString(), any(ResultSetExtractor.class), eq(7L), eq("LOW"), eq("HIGH")))
            .thenAnswer(invocation -> ((ResultSetExtractor<?>) invocation.getArgument(1)).extractData(rs));
        var service = new AlertEventService(jdbc, mock(CurrentUserService.class), mock(AuditService.class));
        var site = new SiteAlertSettings("001", "병원", true, List.of(), 30, false, true, 0, 30,
            null, null, false, List.of(), true, true);
        var transition = service.evaluateColdChiller(site, 20.123, 20.123);
        assertEquals(5L, transition.eventId());
        assertEquals(20.123, transition.value());
        assertEquals("__cold_chiller__", transition.metricKey());
        assertNull(service.evaluateColdChiller(site, 20.123, 20.124));
        verify(jdbc).update(eq("UPDATE alert_event SET recovered_at=? WHERE id=?"), any(java.sql.Timestamp.class), eq(5L));
    }
    @Test
    @SuppressWarnings("unchecked")
    void skippedOneShotAlertCanBeDeliveredAfterQuietHoursEnd() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(Long.class), eq("001"), eq("actemp"))).thenReturn(7L);
        ResultSet rs = mock(ResultSet.class);
        when(rs.next()).thenReturn(true);
        when(rs.getLong("id")).thenReturn(5L);
        when(rs.getString("event_type")).thenReturn("HIGH");
        when(rs.getString("delivery_status")).thenReturn("SKIPPED", "UNKNOWN", "SENDING", "SENT");
        when(jdbc.query(anyString(), any(ResultSetExtractor.class), eq(7L), eq("LOW"), eq("HIGH")))
            .thenAnswer(invocation -> ((ResultSetExtractor<?>) invocation.getArgument(1)).extractData(rs));
        var service = new AlertEventService(jdbc, mock(CurrentUserService.class), mock(AuditService.class));
        var site = new SiteAlertSettings("001", "병원", true, List.of(), 30, false, true, 0, 0, null, null, false);
        var threshold = new AlertThreshold("actemp", "AC Temp", "°C", 15.0, 25.0, true);
        assertEquals(5L, service.evaluate(site, threshold, 31.0).eventId());
        assertNull(service.evaluate(site, threshold, 31.0));
        assertNull(service.evaluate(site, threshold, 31.0));
        assertNull(service.evaluate(site, threshold, 31.0));
    }

    @Test
    @SuppressWarnings("unchecked")
    void repeatKeepsSameIncidentEvenIfDeviationChangesDirection() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(Long.class), eq("001"), eq("actemp"))).thenReturn(7L);
        when(jdbc.query(anyString(), any(ResultSetExtractor.class), eq(7L), eq("LOW"), eq("HIGH")))
            .thenAnswer(invocation -> {
                ResultSet rs = mock(ResultSet.class);
                when(rs.next()).thenReturn(true);
                when(rs.getLong("id")).thenReturn(5L);
                when(rs.getString("event_type")).thenReturn("LOW");
                when(rs.getTimestamp("last_notified_at")).thenReturn(java.sql.Timestamp.from(java.time.Instant.now().minusSeconds(3600)));
                return ((ResultSetExtractor<?>) invocation.getArgument(1)).extractData(rs);
            });
        var service = new AlertEventService(jdbc, mock(CurrentUserService.class), mock(AuditService.class));
        var site = new SiteAlertSettings("001", "병원", true, List.of(), 30, false, true, 0, 30, null, null, false);
        var transition = service.evaluate(site, new AlertThreshold("actemp", "AC Temp", "°C", 15.0, 25.0, true), 31.0);
        assertEquals(5L, transition.eventId());
        assertEquals("HIGH", transition.eventType());
        verify(jdbc, never()).queryForObject(eq("SELECT LAST_INSERT_ID()"), eq(Long.class));
    }

    @Test
    @SuppressWarnings("unchecked")
    void normalRangeClosesIncidentWithoutSendingRecovery() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(Long.class), eq("001"), eq("actemp"))).thenReturn(7L);
        when(jdbc.query(anyString(), any(ResultSetExtractor.class), eq(7L), eq("LOW"), eq("HIGH")))
            .thenAnswer(invocation -> {
                ResultSet rs = mock(ResultSet.class);
                when(rs.next()).thenReturn(true);
                when(rs.getLong("id")).thenReturn(5L);
                return ((ResultSetExtractor<?>) invocation.getArgument(1)).extractData(rs);
            });
        var service = new AlertEventService(jdbc, mock(CurrentUserService.class), mock(AuditService.class));
        var site = new SiteAlertSettings("001", "병원", true, List.of(), 30, false, true, 0, 30, null, null, false);
        assertNull(service.evaluate(site, new AlertThreshold("actemp", "AC Temp", "°C", 15.0, 25.0, true), 20.0));
        verify(jdbc).update(eq("UPDATE alert_event SET recovered_at=? WHERE id=?"), any(java.sql.Timestamp.class), eq(5L));
        verify(jdbc, never()).queryForObject(eq("SELECT LAST_INSERT_ID()"), eq(Long.class));
    }

    @Test
    @SuppressWarnings("unchecked")
    void eventFromAnotherCompanyIsHiddenAsNotFound() throws Exception {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        ResultSet resultSet = mock(ResultSet.class);
        when(resultSet.next()).thenReturn(true);
        when(resultSet.getString(1)).thenReturn("other-site");
        when(jdbcTemplate.query(anyString(), any(ResultSetExtractor.class), eq(99L)))
            .thenAnswer(invocation -> ((ResultSetExtractor<?>) invocation.getArgument(1)).extractData(resultSet));
        AlertEventService service = new AlertEventService(jdbcTemplate,
            mock(CurrentUserService.class), mock(AuditService.class));

        assertThrows(com.pentaworks.monitoring.common.NotFoundException.class,
            () -> service.requireEventAccess(99L, java.util.Set.of("my-site")));
    }

    @Test
    void disabledSiteDoesNotEvaluateMetrics() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        AlertEventService service = new AlertEventService(jdbcTemplate,
            mock(CurrentUserService.class), mock(AuditService.class));
        SiteAlertSettings site = new SiteAlertSettings("001", "병원", true, List.of(), 30, true,
            false, 0, 0, null, null, false);

        assertNull(service.evaluate(site,
            new AlertThreshold("actemp", "AC Temp", "°C", 15.0, 25.0, true), 31.0));
        assertNull(service.evaluateNoData(site, 31L));

        verifyNoInteractions(jdbcTemplate);
    }

    @Test
    void unmeasuredValuesDoNotCreateRangeAlerts() {
        assertNull(AlertEventService.direction(0.0, 0.0, 999.0));
        assertNull(AlertEventService.direction(0.001, 1.0, 999.0));
        assertNull(AlertEventService.direction(0.01, 1.0, 999.0));
        assertNull(AlertEventService.direction(0.1, 1.0, 999.0));
        assertNull(AlertEventService.direction(-3258.2, 1.0, 999.0));
        assertNull(AlertEventService.direction(1.0, 0.0, 999.0));
        assertEquals("low", AlertEventService.direction(0.011, 1.0, 999.0));
    }

    @Test
    void unmeasuredValueDoesNotRecoverAnOpenRangeAlert() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        AlertEventService service = new AlertEventService(jdbcTemplate,
            mock(CurrentUserService.class), mock(AuditService.class));
        SiteAlertSettings site = new SiteAlertSettings("001", "병원", true, List.of(), 30, false,
            true, 0, 0, null, null, false);
        AlertThreshold threshold = new AlertThreshold("actemp", "AC Temp", "°C", 15.0, 25.0, true);

        for (double value : new double[]{0.001, 0.1, -0.1, -3258.2})
            assertNull(service.evaluate(site, threshold, value));

        verifyNoInteractions(jdbcTemplate);
    }

    @Test
    @SuppressWarnings("unchecked")
    void doesNotCreateDuplicateEventForSameOpenDirection() throws Exception {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        AlertEventService service = new AlertEventService(jdbcTemplate,
            mock(CurrentUserService.class), mock(AuditService.class));
        when(jdbcTemplate.queryForObject(anyString(), eq(Long.class), eq("001"), eq("actemp"))).thenReturn(7L);
        when(jdbcTemplate.query(anyString(), any(ResultSetExtractor.class), eq(7L), eq("LOW"), eq("HIGH"))).thenAnswer(invocation -> {
            ResultSet resultSet = mock(ResultSet.class);
            when(resultSet.next()).thenReturn(true);
            when(resultSet.getLong("id")).thenReturn(5L);
            when(resultSet.getString("event_type")).thenReturn("HIGH");
            ResultSetExtractor<?> extractor = invocation.getArgument(1);
            return extractor.extractData(resultSet);
        });
        SiteAlertSettings site = new SiteAlertSettings("001", "병원", true, List.of(), 30, false,
            true, 0, 0, null, null, false);
        AlertThreshold threshold = new AlertThreshold("actemp", "AC Temp", "°C", 15.0, 25.0, true);

        assertNull(service.evaluate(site, threshold, 31.0));

        verify(jdbcTemplate, never()).queryForObject(eq("SELECT LAST_INSERT_ID()"), eq(Long.class));
    }

    @Test
    @SuppressWarnings("unchecked")
    void createsNoDataEventWhenConfiguredDelayIsExceeded() throws Exception {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        AlertEventService service = new AlertEventService(jdbcTemplate,
            mock(CurrentUserService.class), mock(AuditService.class));
        when(jdbcTemplate.queryForObject(anyString(), eq(Long.class), eq("001"))).thenReturn(9L);
        when(jdbcTemplate.query(anyString(), any(ResultSetExtractor.class), eq(9L), eq("NO_DATA")))
            .thenAnswer(invocation -> {
                ResultSet resultSet = mock(ResultSet.class);
                when(resultSet.next()).thenReturn(false);
                ResultSetExtractor<?> extractor = invocation.getArgument(1);
                return extractor.extractData(resultSet);
            });
        when(jdbcTemplate.queryForObject(eq("SELECT LAST_INSERT_ID()"), eq(Long.class))).thenReturn(12L);
        SiteAlertSettings site = new SiteAlertSettings("001", "병원", true, List.of(), 30, true,
            true, 0, 0, null, null, false);

        AlertEventService.Transition transition = service.evaluateNoData(site, 31L);

        assertEquals("NO_DATA", transition.eventType());
        assertEquals("__data__", transition.metricKey());
        assertEquals(31.0, transition.value());
        assertEquals(30.0, transition.max());
    }
}
