package com.pentaworks.monitoring.alert;

import com.pentaworks.monitoring.admin.AuditService;
import com.pentaworks.monitoring.auth.CurrentUserService;
import com.pentaworks.monitoring.auth.CurrentUserService.CurrentUser;
import com.pentaworks.monitoring.common.BadRequestException;
import com.pentaworks.monitoring.common.ForbiddenException;
import com.pentaworks.monitoring.dashboard.DashboardService;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AlertService {
    private static final List<Metric> METRICS = List.of(
        new Metric("recosi", "si410", "리콘덴서 SI", null, 0, 999),
        new Metric("coldtp", "chtemp", "coldtp", null, 0, 999),
        new Metric("recoru", "rou", "리콘덴서 RU", null, 0, 999),
        new Metric("hepres", "psi", "He Pressure", "psi", 1, 999),
        new Metric("heleve", "he", "He Level", "%", 70, 999),
        new Metric("actemp", "actemp", "AC Temp", "°C", 0, 999),
        new Metric("achumi", "achumi", "AC Humidity", "%", 0, 999),
        new Metric("gctemp", "gctemp", "그라디언트칠러 온도", "°C", 0, 999),
        new Metric("gcflow", "gcflow", "그라디언트칠러 유량", null, 0, 999),
        new Metric("cctemp", "cctemp", "콜드칠러 온도", "°C", 0, 999),
        new Metric("ccflow", "ccflow", "콜드칠러 유량", null, 0, 999)
    );
    private static final Map<String, Metric> METRIC_BY_KEY = metricMap();

    private final JdbcTemplate jdbcTemplate;
    private final CurrentUserService currentUsers;
    private final AuditService audit;
    private final DashboardService dashboardService;
    private final AlertEventService alertEvents;

    public AlertService(JdbcTemplate jdbcTemplate, CurrentUserService currentUsers, AuditService audit,
                        DashboardService dashboardService, AlertEventService alertEvents) {
        this.jdbcTemplate = jdbcTemplate;
        this.currentUsers = currentUsers;
        this.audit = audit;
        this.dashboardService = dashboardService;
        this.alertEvents = alertEvents;
    }

    public List<PsiThreshold> psiThresholds(Set<String> allowedSiteIds) {
        return psiThresholds().stream()
            .filter(row -> allowedSiteIds.contains(row.siteid())).toList();
    }

    public List<PsiThreshold> psiThresholds() {
        return alertSettings().stream().map(site -> {
            AlertThreshold pressure = site.thresholds().stream()
                .filter(threshold -> "hepres".equals(threshold.key())).findFirst().orElseThrow();
            return new PsiThreshold(site.siteid(), site.name(), pressure.min(), pressure.max(), pressure.active());
        }).toList();
    }

    public List<SiteAlertSettings> alertSettings(Set<String> allowedSiteIds) {
        return alertSettings().stream().filter(row -> allowedSiteIds.contains(row.siteid())).toList();
    }

    public List<SiteAlertSettings> alertSettings() {
        return jdbcTemplate.query("""
            SELECT a.*, s.site AS registered_site, s.name
              FROM site s LEFT JOIN alert_settings a ON a.siteid=s.site
             ORDER BY s.site
            """, (rs, row) -> settings(rs.getString("registered_site"), rs.getString("name"),
                rs.getObject("id") != null, field -> rs.getString(field), field -> rs.getObject(field)));
    }

    @Transactional
    public PsiThreshold updatePsiThreshold(CurrentUser actor, String siteId, Double min, Double max, boolean active) {
        SiteAlertSettings saved = updateAlertSettings(actor, siteId,
            List.of(new ThresholdUpdate("hepres", min, max, active)));
        AlertThreshold pressure = saved.thresholds().stream()
            .filter(threshold -> "hepres".equals(threshold.key())).findFirst().orElseThrow();
        return new PsiThreshold(saved.siteid(), saved.name(), pressure.min(), pressure.max(), pressure.active());
    }

    @Transactional
    public SiteAlertSettings updateAlertSettings(CurrentUser actor, String siteId, List<ThresholdUpdate> updates) {
        if (!actor.isAdmin()) throw new ForbiddenException("관리자 권한이 필요합니다.");
        currentUsers.requireSiteAccess(actor, siteId);
        if (updates == null || updates.isEmpty()) throw new BadRequestException("변경할 기준값이 없습니다.");
        Set<String> seen = new LinkedHashSet<>();
        for (ThresholdUpdate update : updates) {
            Metric metric = METRIC_BY_KEY.get(update.key());
            if (metric == null) throw new BadRequestException("지원하지 않는 측정항목입니다: " + update.key());
            if (!seen.add(update.key())) throw new BadRequestException("중복된 측정항목입니다: " + update.key());
            validateThreshold(update.min(), update.max());
        }
        jdbcTemplate.update("INSERT IGNORE INTO alert_settings (siteid) VALUES (?)", siteId);
        for (ThresholdUpdate update : updates) {
            Metric metric = METRIC_BY_KEY.get(update.key());
            String prefix = metric.storagePrefix();
            jdbcTemplate.update("UPDATE alert_settings SET " + prefix + "_min=?," + prefix + "_max=?," +
                    prefix + "_active=?,updated_at=CURRENT_TIMESTAMP WHERE siteid=?",
                update.min(), update.max(), update.active(), siteId);
            if (!update.active()) alertEvents.disableRule(siteId, update.key());
        }
        audit.record(actor, "ALERT_THRESHOLDS_UPDATED", "SITE", siteId,
            Map.of("thresholds", updates.stream().map(update -> Map.of(
                "key", update.key(), "min", update.min(), "max", update.max(), "active", update.active())).toList()));
        dashboardService.invalidateCache();
        return settings(siteId);
    }

    static void validateThreshold(Double min, Double max) {
        if (min == null || max == null || !Double.isFinite(min) || !Double.isFinite(max)) {
            throw new BadRequestException("최소값과 최대값을 숫자로 입력해주세요.");
        }
        if (min < 0 || max < 0) throw new BadRequestException("기준값은 0 이상이어야 합니다.");
        if (min > max) throw new BadRequestException("최소값은 최대값보다 클 수 없습니다.");
    }

    private SiteAlertSettings settings(String siteId) {
        return jdbcTemplate.queryForObject("""
            SELECT a.*, s.site AS registered_site, s.name
              FROM site s LEFT JOIN alert_settings a ON a.siteid=s.site
             WHERE s.site=?
            """, (rs, row) -> settings(rs.getString("registered_site"), rs.getString("name"),
                rs.getObject("id") != null, field -> rs.getString(field), field -> rs.getObject(field)),
            siteId);
    }

    private SiteAlertSettings settings(String siteId, String name, boolean exists,
                                       SqlStringValue strings, SqlObjectValue objects) throws SQLException {
        List<AlertThreshold> thresholds = new ArrayList<>();
        for (Metric metric : METRICS) {
            String prefix = metric.storagePrefix();
            Double min = DashboardService.parseNumber(strings.get(prefix + "_min"));
            Double max = DashboardService.parseNumber(strings.get(prefix + "_max"));
            if (min == null) min = metric.defaultMin();
            if (max == null) max = metric.defaultMax();
            boolean active = exists && (objects.get(prefix + "_active") == null
                || !"0".equals(strings.get(prefix + "_active")));
            thresholds.add(new AlertThreshold(metric.key(), metric.label(), metric.unit(), min, max, active));
        }
        return new SiteAlertSettings(siteId, name, exists, thresholds);
    }

    private static Map<String, Metric> metricMap() {
        Map<String, Metric> result = new LinkedHashMap<>();
        METRICS.forEach(metric -> result.put(metric.key(), metric));
        return Map.copyOf(result);
    }

    @FunctionalInterface private interface SqlStringValue { String get(String field) throws SQLException; }
    @FunctionalInterface private interface SqlObjectValue { Object get(String field) throws SQLException; }
    private record Metric(String key, String storagePrefix, String label, String unit,
                          double defaultMin, double defaultMax) {}
    public record ThresholdUpdate(String key, Double min, Double max, boolean active) {}
}
