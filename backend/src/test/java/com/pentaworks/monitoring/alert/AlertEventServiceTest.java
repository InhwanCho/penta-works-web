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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AlertEventServiceTest {
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
        SiteAlertSettings site = new SiteAlertSettings("001", "병원", true, List.of(), 30, false);
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
        SiteAlertSettings site = new SiteAlertSettings("001", "병원", true, List.of(), 30, true);

        AlertEventService.Transition transition = service.evaluateNoData(site, 31L);

        assertEquals("NO_DATA", transition.eventType());
        assertEquals("__data__", transition.metricKey());
        assertEquals(31.0, transition.value());
        assertEquals(30.0, transition.max());
    }
}
