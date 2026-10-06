package com.pentaworks.monitoring.alert;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RollingAverageServiceTest {
    @Test
    void defaultsToAverageAndReadsPersistedSnapshotWithoutRecalculatingMeasurements() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        ResultSet rs = mock(ResultSet.class);
        LocalDateTime now = RollingAverageService.now();
        when(rs.getString("site_id")).thenReturn("001");
        when(rs.getString("metric_key")).thenReturn("hepres");
        when(rs.getObject("average_value")).thenReturn(10.0);
        when(rs.getDouble("average_value")).thenReturn(10.0);
        when(rs.getInt("sample_count")).thenReturn(24);
        when(rs.getTimestamp("captured_at")).thenReturn(Timestamp.valueOf(now));
        when(rs.getTimestamp("last_sample_at")).thenReturn(Timestamp.valueOf(now));
        doAnswer(invocation -> {
            invocation.<RowCallbackHandler>getArgument(1).processRow(rs);
            return null;
        }).when(jdbc).query(contains("FROM site_metric_average_hourly"), any(RowCallbackHandler.class),
            any(Timestamp.class));
        var state = new RollingAverageService(jdbc).states().get("001").get("hepres");
        assertTrue(state.useAverage());
        assertEquals(30.0, state.tolerancePercent());
        assertEquals(30.0, new AlertThreshold("hepres", "He Pressure", "psi", 0.0, 20.0, true).tolerancePercent());
        assertEquals(7.0, RollingAverageService.effectiveRange(state, now).min());
        assertEquals(13.0, RollingAverageService.effectiveRange(state, now).max());
        org.mockito.Mockito.verify(jdbc, org.mockito.Mockito.never()).query(
            contains("FROM mrtb"), any(RowCallbackHandler.class), any(Timestamp.class), any(Timestamp.class));
    }

    @Test
    void retainsExplicitAverageOptOut() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        ResultSet rs = mock(ResultSet.class);
        when(rs.getString("site_id")).thenReturn("001");
        when(rs.getString("metric_key")).thenReturn("hepres");
        when(rs.getBoolean("use_average")).thenReturn(false);
        when(rs.getDouble("tolerance_percent")).thenReturn(15.0);
        doAnswer(invocation -> {
            invocation.<RowCallbackHandler>getArgument(1).processRow(rs);
            return null;
        }).when(jdbc).query(contains("FROM site_metric_average_policy"), any(RowCallbackHandler.class));
        var state = new RollingAverageService(jdbc).states().get("001").get("hepres");
        assertFalse(state.useAverage());
        assertEquals(15.0, state.tolerancePercent());
    }
    @Test
    void excludesUnmeasuredValuesFromHourlyRollingAverage() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        ResultSet rs = mock(ResultSet.class);
        when(rs.getString("siteid")).thenReturn("001");
        when(rs.getBoolean("hepres_unmeasured")).thenReturn(true, true, true, false, false);
        when(rs.getString("hepres")).thenReturn("1.2", "1.4");
        when(rs.getTimestamp("date")).thenReturn(Timestamp.valueOf("2026-09-29 12:30:00"));
        doAnswer(invocation -> {
            RowCallbackHandler handler = invocation.getArgument(1);
            handler.processRow(rs);
            handler.processRow(rs);
            handler.processRow(rs);
            handler.processRow(rs);
            handler.processRow(rs);
            return null;
        }).when(jdbc).query(contains("FROM mrtb m JOIN company_site"), any(RowCallbackHandler.class),
            any(Timestamp.class), any(Timestamp.class));
        LocalDateTime hour = LocalDateTime.of(2026, 9, 29, 13, 0);

        new RollingAverageService(jdbc).captureAt(hour);

        verify(jdbc).update(contains("INSERT INTO site_metric_average_hourly"), eq("001"), eq("hepres"),
            eq(Timestamp.valueOf(hour)), eq(Timestamp.valueOf("2026-09-29 12:30:00")),
            argThat((Double value) -> Math.abs(value - 1.3) < 0.000001),
            eq(2), eq(3));
    }

    @Test
    void appliesAverageOnlyWithEnoughRecentNonzeroSamples() {
        LocalDateTime now = LocalDateTime.of(2026, 9, 29, 13, 30);
        var fresh = new RollingAverageService.AverageState(true, 20, 10.0, 12, 3,
            now.minusMinutes(30), now.minusMinutes(10));
        var range = RollingAverageService.effectiveRange(fresh, now);
        assertEquals(8.0, range.min());
        assertEquals(12.0, range.max());
        assertNull(RollingAverageService.effectiveRange(new RollingAverageService.AverageState(
            true, 20, 10.0, 11, 3, now.minusMinutes(30), now.minusMinutes(10)), now));
        assertNull(RollingAverageService.effectiveRange(new RollingAverageService.AverageState(
            true, 20, 10.0, 12, 3, now.minusHours(3), now.minusMinutes(10)), now));
        assertNull(RollingAverageService.effectiveRange(new RollingAverageService.AverageState(
            true, 20, 10.0, 12, 3, now.minusMinutes(30), now.minusHours(3)), now));
        assertNull(RollingAverageService.effectiveRange(new RollingAverageService.AverageState(
            false, 20, 10.0, 12, 3, now.minusMinutes(30), now.minusMinutes(10)), now));
    }
}
