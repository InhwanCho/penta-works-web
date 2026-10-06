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
        assertEquals(40.0, state.tolerancePercent());
        assertEquals(40.0, new AlertThreshold("hepres", "He Pressure", "psi", 0.0, 20.0, true).tolerancePercent());
        assertEquals(6.0, RollingAverageService.effectiveRange(state, now).min());
        assertEquals(14.0, RollingAverageService.effectiveRange(state, now).max());
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
        when(rs.getBoolean("hepres_unmeasured")).thenReturn(true, true, true, false, false, false, false);
        when(rs.getString("hepres")).thenReturn("0.1", "-3258.2", "1.2", "1.4");
        when(rs.getTimestamp("date")).thenReturn(Timestamp.valueOf("2026-09-29 12:30:00"));
        doAnswer(invocation -> {
            RowCallbackHandler handler = invocation.getArgument(1);
            handler.processRow(rs);
            handler.processRow(rs);
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
            eq(2), eq(5));
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
    @Test
    void explainsFallbackAndSeparatesEligibilityFromSelectedMode() {
        LocalDateTime now = LocalDateTime.of(2026,10,6,12,0);
        var insufficient = new RollingAverageService.AverageState(true,60,34.15,6,0,now,now.minusMinutes(4));
        assertEquals("INSUFFICIENT_SAMPLES",RollingAverageService.unavailableReason(insufficient,now));
        assertNull(RollingAverageService.effectiveRange(insufficient,now));
        var ready = new RollingAverageService.AverageState(true,60,34.15,12,0,now,now.minusMinutes(4));
        assertEquals(13.66,RollingAverageService.effectiveRange(ready,now).min(),0.000001);
        assertEquals(54.64,RollingAverageService.effectiveRange(ready,now).max(),0.000001);
        var manual = new RollingAverageService.AverageState(false,60,34.15,12,0,now,now.minusMinutes(4));
        assertNull(RollingAverageService.unavailableReason(manual,now));
        assertNull(RollingAverageService.effectiveRange(manual,now));
        assertEquals("MEASUREMENT_EXPIRED",RollingAverageService.unavailableReason(new RollingAverageService.AverageState(true,60,34.15,12,0,now,now.minusHours(3)),now));
        assertEquals("AVERAGE_EXPIRED",RollingAverageService.unavailableReason(new RollingAverageService.AverageState(true,60,34.15,12,0,now.minusHours(3),now),now));
    }

    @Test
    void reusesHealthyAverageAcrossMultiDayShutdownAndReturnsToRecentWhenReady() {
        LocalDateTime now = LocalDateTime.of(2026,10,6,12,0);
        LocalDateTime captured = now.minusDays(4);
        var recent = new RollingAverageService.AverageState(true,60,34.15,6,0,now,now.minusMinutes(4));
        var past = new RollingAverageService.AverageState(true,40,50.0,100,20,captured,captured.minusMinutes(15),true);
        var selected = RollingAverageService.selectAverage(recent,past,now);
        assertTrue(selected.historical());
        assertEquals(60,selected.tolerancePercent());
        assertEquals(captured,selected.capturedAt());
        assertEquals(20,RollingAverageService.effectiveRange(selected,now).min());
        assertEquals(80,RollingAverageService.effectiveRange(selected,now).max());
        var recovered = new RollingAverageService.AverageState(true,60,34.15,12,0,now,now.minusMinutes(4));
        assertEquals(recovered,RollingAverageService.selectAverage(recovered,past,now));
        assertFalse(RollingAverageService.selectAverage(recovered,past,now).historical());
    }

    @Test
    void historicalFallbackRejectsInsufficientStaleAtCaptureAndFutureSnapshots() {
        LocalDateTime now = LocalDateTime.of(2026,10,6,12,0);
        LocalDateTime past = now.minusDays(3);
        var missing = RollingAverageService.AverageState.DEFAULT;
        var sparse = new RollingAverageService.AverageState(true,40,50.0,6,0,past,past.minusMinutes(10),true);
        var stale = new RollingAverageService.AverageState(true,40,50.0,100,0,past,past.minusHours(3),true);
        var future = new RollingAverageService.AverageState(true,40,50.0,100,0,now.plusDays(1),now.plusDays(1),true);
        assertEquals(missing,RollingAverageService.selectAverage(missing,null,now));
        assertEquals(missing,RollingAverageService.selectAverage(missing,sparse,now));
        assertEquals(missing,RollingAverageService.selectAverage(missing,stale,now));
        assertEquals(missing,RollingAverageService.selectAverage(missing,future,now));
        assertNull(RollingAverageService.effectiveRange(missing,now));
    }

    @Test
    void historicalFallbackPreservesManualModeAndSavedTolerance() {
        LocalDateTime now = LocalDateTime.of(2026,10,6,12,0);
        var manual = new RollingAverageService.AverageState(false,25,null,0,0,null,null);
        var past = new RollingAverageService.AverageState(true,40,50.0,100,0,now.minusDays(2),now.minusDays(2),true);
        var selected = RollingAverageService.selectAverage(manual,past,now);
        assertFalse(selected.useAverage());
        assertEquals(25,selected.tolerancePercent());
        assertNull(RollingAverageService.effectiveRange(selected,now));
        assertNull(RollingAverageService.unavailableReason(selected,now));
    }

    @Test
    void loadsHistoricalFallbackSeparatelyForEachSiteAndMetric() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        LocalDateTime now = RollingAverageService.now();
        ResultSet rs = mock(ResultSet.class);
        when(rs.getString("site_id")).thenReturn("001");
        when(rs.getString("metric_key")).thenReturn("achumi");
        when(rs.getObject("average_value")).thenReturn(34.15);
        when(rs.getDouble("average_value")).thenReturn(34.15);
        when(rs.getInt("sample_count")).thenReturn(6);
        when(rs.getTimestamp("captured_at")).thenReturn(Timestamp.valueOf(now));
        when(rs.getTimestamp("last_sample_at")).thenReturn(Timestamp.valueOf(now));
        doAnswer(invocation -> {
            invocation.<RowCallbackHandler>getArgument(1).processRow(rs);
            return null;
        }).when(jdbc).query(contains("WHERE captured_at>=?"), any(RowCallbackHandler.class),any(Timestamp.class));
        ResultSet history = mock(ResultSet.class);
        when(history.getString("site_id")).thenReturn("001","002");
        when(history.getString("metric_key")).thenReturn("achumi","hepres");
        when(history.getObject("average_value")).thenReturn(50.0);
        when(history.getDouble("average_value")).thenReturn(50.0,1.0);
        when(history.getInt("sample_count")).thenReturn(100);
        when(history.getTimestamp("captured_at")).thenReturn(Timestamp.valueOf(now.minusDays(4)));
        when(history.getTimestamp("last_sample_at")).thenReturn(Timestamp.valueOf(now.minusDays(4).minusMinutes(10)));
        doAnswer(invocation -> {
            var handler = invocation.<RowCallbackHandler>getArgument(1);
            handler.processRow(history);
            handler.processRow(history);
            return null;
        }).when(jdbc).query(contains("MAX(captured_at)"),any(RowCallbackHandler.class),any(Timestamp.class));
        var states = new RollingAverageService(jdbc).states();
        assertEquals(50.0,states.get("001").get("achumi").averageValue());
        assertEquals(1.0,states.get("002").get("hepres").averageValue());
        assertTrue(states.get("001").get("achumi").historical());
        assertFalse(states.get("001").containsKey("hepres"));
        verify(jdbc).query(contains("GROUP BY site_id,metric_key"),any(RowCallbackHandler.class),any(Timestamp.class));
    }

}
