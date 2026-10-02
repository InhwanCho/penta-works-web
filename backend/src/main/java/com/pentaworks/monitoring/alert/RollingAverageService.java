package com.pentaworks.monitoring.alert;

import com.pentaworks.monitoring.dashboard.DashboardService;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class RollingAverageService {
    private static final Logger log = LoggerFactory.getLogger(RollingAverageService.class);
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private static final List<String> METRIC_KEYS = List.of(
        "recosi", "coldtp", "recoru", "hepres", "heleve", "actemp", "achumi",
        "gctemp", "gcflow", "cctemp", "ccflow");
    static final int MIN_SAMPLES = 12;
    private final JdbcTemplate jdbcTemplate;

    public RollingAverageService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @EventListener(ApplicationReadyEvent.class)
    @Scheduled(cron = "0 0 * * * *", zone = "Asia/Seoul")
    public void captureCurrentHour() {
        try {
            captureAt(LocalDateTime.now(SEOUL).truncatedTo(ChronoUnit.HOURS));
        } catch (RuntimeException error) {
            log.warn("Rolling average capture failed; existing alert thresholds remain in use", error);
        }
    }

    void captureAt(LocalDateTime end) {
        Map<String, Map<String, Accumulator>> values = new LinkedHashMap<>();
        jdbcTemplate.query("""
            SELECT m.siteid,m.date,m.recosi_value AS recosi,m.coldtp_value AS coldtp,
                   m.recoru_value AS recoru,m.hepres_value AS hepres,m.heleve_value AS heleve,
                   m.actemp_value AS actemp,m.achumi_value AS achumi,m.gctemp_value AS gctemp,
                   m.gcflow_value AS gcflow,m.cctemp_value AS cctemp,m.ccflow_value AS ccflow,
                   m.recosi_unmeasured,m.coldtp_unmeasured,m.recoru_unmeasured,
                   m.hepres_unmeasured,m.heleve_unmeasured,m.actemp_unmeasured,
                   m.achumi_unmeasured,m.gctemp_unmeasured,m.gcflow_unmeasured,
                   m.cctemp_unmeasured,m.ccflow_unmeasured
              FROM mrtb m JOIN company_site cs ON cs.site_id=m.siteid
             WHERE m.date>=? AND m.date<?
            """, (RowCallbackHandler) rs -> {
                Map<String, Accumulator> site = values.computeIfAbsent(rs.getString("siteid"),
                    ignored -> new HashMap<>());
                for (String key : METRIC_KEYS) {
                    Accumulator accumulator = site.computeIfAbsent(key, ignored -> new Accumulator());
                    if (rs.getBoolean(key + "_unmeasured")) {
                        // Keep the historical zero_count field for API compatibility.
                        accumulator.zeroCount++;
                    } else {
                        Double value = DashboardService.parseNumber(rs.getString(key));
                        if (value == null || !Double.isFinite(value)) continue;
                        accumulator.sum += value;
                        accumulator.sampleCount++;
                        Timestamp sampleAt = rs.getTimestamp("date");
                        if (sampleAt != null && (accumulator.lastSampleAt == null ||
                            sampleAt.toLocalDateTime().isAfter(accumulator.lastSampleAt)))
                            accumulator.lastSampleAt = sampleAt.toLocalDateTime();
                    }
                }
            }, Timestamp.valueOf(end.minusHours(24)), Timestamp.valueOf(end));
        values.forEach((siteId, metrics) -> metrics.forEach((key, value) -> jdbcTemplate.update("""
            INSERT INTO site_metric_average_hourly
                (site_id,metric_key,captured_at,last_sample_at,average_value,sample_count,zero_count)
            VALUES (?,?,?,?,?,?,?)
            ON DUPLICATE KEY UPDATE average_value=VALUES(average_value),
                sample_count=VALUES(sample_count),zero_count=VALUES(zero_count),
                last_sample_at=VALUES(last_sample_at)
            """, siteId, key, Timestamp.valueOf(end),
            value.lastSampleAt == null ? null : Timestamp.valueOf(value.lastSampleAt),
            value.sampleCount == 0 ? null : value.sum / value.sampleCount,
            value.sampleCount, value.zeroCount)));
        log.info("Captured 24-hour rolling averages for {} sites at {}", values.size(), end);
    }

    public Map<String, Map<String, AverageState>> states() {
        Map<String, Map<String, AverageState>> result = new HashMap<>();
        jdbcTemplate.query("""
            SELECT site_id,metric_key,use_average,tolerance_percent FROM site_metric_average_policy
            """, (RowCallbackHandler) rs -> result
                .computeIfAbsent(rs.getString("site_id"), ignored -> new HashMap<>())
                .put(rs.getString("metric_key"), new AverageState(rs.getBoolean("use_average"),
                    rs.getDouble("tolerance_percent"), null, 0, 0, null, null)));
        LocalDateTime earliest = LocalDateTime.now(SEOUL).minusHours(3);
        jdbcTemplate.query("""
            SELECT site_id,metric_key,average_value,sample_count,zero_count,captured_at,last_sample_at
              FROM site_metric_average_hourly WHERE captured_at>=?
             ORDER BY captured_at DESC
            """, (RowCallbackHandler) rs -> {
                Map<String, AverageState> site = result.computeIfAbsent(rs.getString("site_id"),
                    ignored -> new HashMap<>());
                String key = rs.getString("metric_key");
                AverageState prior = site.getOrDefault(key, AverageState.DEFAULT);
                if (prior.capturedAt() != null) return;
                site.put(key, new AverageState(prior.useAverage(), prior.tolerancePercent(),
                    rs.getObject("average_value") == null ? null : rs.getDouble("average_value"),
                    rs.getInt("sample_count"), rs.getInt("zero_count"),
                    rs.getTimestamp("captured_at").toLocalDateTime(),
                    rs.getTimestamp("last_sample_at") == null ? null :
                        rs.getTimestamp("last_sample_at").toLocalDateTime()));
            }, Timestamp.valueOf(earliest));
        return result;
    }

    public static Range effectiveRange(AverageState state, LocalDateTime now) {
        if (state == null || !state.useAverage() || state.averageValue() == null ||
            !Double.isFinite(state.averageValue()) || state.averageValue() == 0.0 ||
            state.sampleCount() < MIN_SAMPLES || state.capturedAt() == null || state.lastSampleAt() == null ||
            state.capturedAt().isBefore(now.minusHours(2)) || state.capturedAt().isAfter(now.plusMinutes(5)) ||
            state.lastSampleAt().isBefore(now.minusHours(2)) || state.lastSampleAt().isAfter(now.plusMinutes(5)) ||
            !Double.isFinite(state.tolerancePercent()) || state.tolerancePercent() <= 0 ||
            state.tolerancePercent() > 100) return null;
        double tolerance = Math.abs(state.averageValue()) * state.tolerancePercent() / 100.0;
        return new Range(state.averageValue() - tolerance, state.averageValue() + tolerance);
    }

    public static LocalDateTime now() { return LocalDateTime.now(SEOUL); }

    private static final class Accumulator {
        double sum;
        int sampleCount;
        int zeroCount;
        LocalDateTime lastSampleAt;
    }

    public record AverageState(boolean useAverage, double tolerancePercent, Double averageValue,
                               int sampleCount, int zeroCount, LocalDateTime capturedAt,
                               LocalDateTime lastSampleAt) {
        public static final AverageState DEFAULT = new AverageState(false, 20, null, 0, 0, null, null);
    }
    public record Range(double min, double max) {}
}
