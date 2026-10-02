package com.pentaworks.monitoring.alert;

import com.pentaworks.monitoring.admin.AuditService;
import com.pentaworks.monitoring.auth.CurrentUserService;
import com.pentaworks.monitoring.auth.CurrentUserService.CurrentUser;
import com.pentaworks.monitoring.common.BadRequestException;
import com.pentaworks.monitoring.common.ForbiddenException;
import com.pentaworks.monitoring.dashboard.DashboardService;
import java.sql.SQLException;
import java.sql.Time;
import java.time.LocalTime;
import java.time.LocalDate;
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
        new Metric("recosi", "si410", "리콘덴서 Si410 온도", "K", 0, 999),
        new Metric("coldtp", "chtemp", "콜드헤드 온도", "K", 0, 999),
        new Metric("recoru", "rou", "리콘덴서 RuO 온도", "K", 0, 999),
        new Metric("hepres", "psi", "He Pressure", "psi", 1, 999),
        new Metric("heleve", "he", "He Level", "%", 70, 999),
        new Metric("actemp", "actemp", "항온항습기 온도", "°C", 0, 999),
        new Metric("achumi", "achumi", "항온항습기 습도", "%", 0, 999),
        new Metric("gctemp", "gctemp", "그라디언트칠러 온도", "°C", 0, 999),
        new Metric("gcflow", "gcflow", "그라디언트칠러 유량", null, 0, 999),
        new Metric("cctemp", "cctemp", "콜드칠러 IN 온도", "°C", 0, 999),
        new Metric("ccflow", "ccflow", "콜드칠러 OUT 온도", "°C", 0, 999)
    );
    private static final Map<String, Metric> METRIC_BY_KEY = metricMap();

    private final JdbcTemplate jdbcTemplate;
    private final CurrentUserService currentUsers;
    private final AuditService audit;
    private final DashboardService dashboardService;
    private final AlertEventService alertEvents;
    private final RollingAverageService averages;

    public AlertService(JdbcTemplate jdbcTemplate, CurrentUserService currentUsers, AuditService audit,
                        DashboardService dashboardService, AlertEventService alertEvents,
                        RollingAverageService averages) {
        this.jdbcTemplate = jdbcTemplate;
        this.currentUsers = currentUsers;
        this.audit = audit;
        this.dashboardService = dashboardService;
        this.alertEvents = alertEvents;
        this.averages = averages;
    }

    public List<PsiThreshold> psiThresholds(Set<String> allowedSiteIds) {
        return psiThresholds().stream()
            .filter(row -> allowedSiteIds.contains(row.siteid())).toList();
    }

    public List<PsiThreshold> psiThresholds() {
        return alertSettings().stream().map(site -> {
            AlertThreshold pressure = site.thresholds().stream()
                .filter(threshold -> "hepres".equals(threshold.key())).findFirst().orElseThrow();
            return new PsiThreshold(site.siteid(), site.name(), pressure.effectiveMin(),
                pressure.effectiveMax(), pressure.active());
        }).toList();
    }

    public List<SiteAlertSettings> alertSettings(Set<String> allowedSiteIds) {
        return alertSettings().stream().filter(row -> allowedSiteIds.contains(row.siteid())).toList();
    }

    public List<SiteAlertSettings> alertSettings() {
        Map<String, List<LocalDate>> holidays = holidayDates();
        Map<Long, Map<String, AlertThreshold>> companyDefaults = companyDefaults();
        Map<String, Map<String, RollingAverageService.AverageState>> averageStates = averages.states();
        return jdbcTemplate.query("""
            SELECT a.*, s.site AS registered_site, s.name,cs.company_id,cs.is_dashboard_visible,
                   nd.no_data_minutes,nd.is_enabled AS no_data_active,
                   p.is_enabled AS alerts_enabled,p.trigger_after_minutes,p.repeat_minutes,
                   p.quiet_start,p.quiet_end,p.suppress_weekends,p.cold_chiller_active,p.collection_interval_minutes,p.missing_collection_threshold
              FROM site s LEFT JOIN alert_settings a ON a.siteid=s.site
              LEFT JOIN company_site cs ON cs.site_id=s.site
              LEFT JOIN alert_rule nd ON nd.site_id=s.site AND nd.metric_key='__data__'
                                      AND nd.rule_type='NO_DATA'
              LEFT JOIN site_alert_policy p ON p.site_id=s.site
             ORDER BY s.site
            """, (rs, row) -> settings(rs.getString("registered_site"), rs.getString("name"),
                rs.getObject("id") != null, field -> rs.getString(field), field -> rs.getObject(field),
                rs.getObject("no_data_minutes") == null ? 30 : rs.getInt("no_data_minutes"),
                rs.getObject("no_data_active") != null && rs.getBoolean("no_data_active"),
                rs.getObject("alerts_enabled") == null || rs.getBoolean("alerts_enabled"),
                rs.getObject("trigger_after_minutes") == null ? 0 : rs.getInt("trigger_after_minutes"),
                rs.getObject("repeat_minutes") == null ? 30 : rs.getInt("repeat_minutes"),
                localTime(rs.getTime("quiet_start")), localTime(rs.getTime("quiet_end")),
                rs.getObject("suppress_weekends") != null && rs.getBoolean("suppress_weekends"),
                holidays.getOrDefault(rs.getString("registered_site"), List.of()),
                rs.getObject("is_dashboard_visible") != null && rs.getBoolean("is_dashboard_visible"),
                companyDefaults.getOrDefault(rs.getLong("company_id"), Map.of()),
                averageStates.getOrDefault(rs.getString("registered_site"), Map.of()), rs.getBoolean("cold_chiller_active"),
                rs.getObject("collection_interval_minutes") == null ? 10 : rs.getInt("collection_interval_minutes"),
                rs.getObject("missing_collection_threshold") == null ? 2 : rs.getInt("missing_collection_threshold")));
    }

    public List<AlertThreshold> companyThresholds(CurrentUser actor) {
        if (!actor.isAdmin()) throw new ForbiddenException("관리자 권한이 필요합니다.");
        Map<String, AlertThreshold> configured = companyDefaults().getOrDefault(actor.companyId(), Map.of());
        return METRICS.stream().map(metric -> configured.getOrDefault(metric.key(),
            new AlertThreshold(metric.key(), metric.label(), metric.unit(),
                metric.defaultMin(), metric.defaultMax(), false))).toList();
    }

    @Transactional
    public SiteAlertSettings setAlertsEnabled(CurrentUser actor, String siteId, boolean enabled) {
        if (!actor.isAdmin()) throw new ForbiddenException("관리자 권한이 필요합니다.");
        currentUsers.requireSiteAccess(actor, siteId);
        if (enabled && !currentUsers.visibleSiteIds(actor).contains(siteId)) {
            throw new BadRequestException("대시보드에 표시되는 사업장만 알림을 켤 수 있습니다.");
        }
        jdbcTemplate.update("""
            INSERT INTO site_alert_policy (site_id,is_enabled,created_at,updated_at)
            VALUES (?,?,CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6))
            ON DUPLICATE KEY UPDATE is_enabled=VALUES(is_enabled),updated_at=CURRENT_TIMESTAMP(6)
            """, siteId, enabled);
        if (!enabled) alertEvents.disableSite(siteId);
        audit.record(actor, "SITE_ALERT_POLICY_UPDATED", "SITE", siteId, Map.of("enabled", enabled));
        dashboardService.invalidateCache();
        return settings(siteId);
    }

    @Transactional
    public List<AlertThreshold> updateCompanyThresholds(CurrentUser actor, List<ThresholdUpdate> updates) {
        if (!actor.isSuperAdmin()) throw new ForbiddenException("회사 최고관리자 권한이 필요합니다.");
        if (updates == null || updates.isEmpty()) throw new BadRequestException("변경할 기준값이 없습니다.");
        Set<String> seen = new LinkedHashSet<>();
        for (ThresholdUpdate update : updates) {
            if (!METRIC_BY_KEY.containsKey(update.key()) || !seen.add(update.key())) {
                throw new BadRequestException("중복되거나 지원하지 않는 측정항목입니다.");
            }
            validateThreshold(update.min(), update.max());
        }
        for (ThresholdUpdate update : updates) {
            jdbcTemplate.update("""
                INSERT INTO company_alert_threshold (company_id,metric_key,min_value,max_value,is_enabled)
                VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE min_value=VALUES(min_value),
                    max_value=VALUES(max_value),is_enabled=VALUES(is_enabled),updated_at=CURRENT_TIMESTAMP(6)
                """, actor.companyId(), update.key(), update.min(), update.max(), update.active());
            if (!update.active()) {
                List<String> inheriting = jdbcTemplate.query("""
                    SELECT cs.site_id FROM company_site cs LEFT JOIN alert_settings a ON a.siteid=cs.site_id
                     WHERE cs.company_id=? AND a.siteid IS NULL
                    """, (rs, row) -> rs.getString(1), actor.companyId());
                if (inheriting != null) inheriting.forEach(siteId -> alertEvents.disableRule(siteId, update.key()));
            }
        }
        audit.record(actor, "COMPANY_THRESHOLDS_UPDATED", "COMPANY", String.valueOf(actor.companyId()),
            Map.of("metricKeys", updates.stream().map(ThresholdUpdate::key).toList()));
        dashboardService.invalidateCache();
        return companyThresholds(actor);
    }

    @Transactional
    public SiteAlertSettings restoreCompanyThresholds(CurrentUser actor, String siteId) {
        if (!actor.isAdmin()) throw new ForbiddenException("관리자 권한이 필요합니다.");
        currentUsers.requireSiteAccess(actor, siteId);
        jdbcTemplate.update("DELETE FROM alert_settings WHERE siteid=?", siteId);
        jdbcTemplate.update("DELETE FROM site_metric_average_policy WHERE site_id=?", siteId);
        METRICS.forEach(metric -> alertEvents.disableRule(siteId, metric.key()));
        audit.record(actor, "SITE_THRESHOLDS_RESTORED", "SITE", siteId,
            Map.of("source", "COMPANY"));
        dashboardService.invalidateCache();
        return settings(siteId);
    }

    @Transactional
    public PsiThreshold updatePsiThreshold(CurrentUser actor, String siteId, Double min, Double max, boolean active) {
        SiteAlertSettings saved = updateAlertSettings(actor, siteId,
            List.of(new ThresholdUpdate("hepres", min, max, active)));
        AlertThreshold pressure = saved.thresholds().stream()
            .filter(threshold -> "hepres".equals(threshold.key())).findFirst().orElseThrow();
        return new PsiThreshold(saved.siteid(), saved.name(), pressure.effectiveMin(),
            pressure.effectiveMax(), pressure.active());
    }

    @Transactional
    public SiteAlertSettings updateAlertSettings(CurrentUser actor, String siteId, List<ThresholdUpdate> updates) {
        if (!actor.isAdmin()) throw new ForbiddenException("관리자 권한이 필요합니다.");
        SiteAlertSettings current = settings(siteId);
        return updateAlertSettings(actor, siteId, updates, current.noDataMinutes(), current.noDataActive(),
            current.alertsEnabled(), current.triggerAfterMinutes(), current.repeatMinutes(),
            current.quietStart(), current.quietEnd(), current.suppressWeekends(), current.holidayDates());
    }

    @Transactional
    public SiteAlertSettings updateAlertSettings(CurrentUser actor, String siteId, List<ThresholdUpdate> updates,
                                                 Integer noDataMinutes, Boolean noDataActive,
                                                 Boolean alertsEnabled, Integer triggerAfterMinutes,
                                                 Integer repeatMinutes, LocalTime quietStart, LocalTime quietEnd,
                                                 Boolean suppressWeekends, List<LocalDate> holidayDates) {
        return updateAlertSettings(actor, siteId, updates, noDataMinutes, noDataActive, alertsEnabled,
            triggerAfterMinutes, repeatMinutes, quietStart, quietEnd, suppressWeekends, holidayDates, null);
    }

    @Transactional
    public SiteAlertSettings updateAlertSettings(CurrentUser actor, String siteId, List<ThresholdUpdate> updates,
                                                 Integer noDataMinutes, Boolean noDataActive,
                                                 Boolean alertsEnabled, Integer triggerAfterMinutes,
                                                 Integer repeatMinutes, LocalTime quietStart, LocalTime quietEnd,
                                                 Boolean suppressWeekends, List<LocalDate> holidayDates,
                                                 Boolean coldChillerActive) {
        return updateAlertSettings(actor, siteId, updates, noDataMinutes, noDataActive, alertsEnabled,
            triggerAfterMinutes, repeatMinutes, quietStart, quietEnd, suppressWeekends, holidayDates,
            coldChillerActive, null, null);
    }

    @Transactional
    public SiteAlertSettings updateAlertSettings(CurrentUser actor, String siteId, List<ThresholdUpdate> updates,
                                                 Integer noDataMinutes, Boolean noDataActive,
                                                 Boolean alertsEnabled, Integer triggerAfterMinutes,
                                                 Integer repeatMinutes, LocalTime quietStart, LocalTime quietEnd,
                                                 Boolean suppressWeekends, List<LocalDate> holidayDates,
                                                 Boolean coldChillerActive, Integer collectionIntervalMinutes,
                                                 Integer missingCollectionThreshold) {
        if (!actor.isAdmin()) throw new ForbiddenException("관리자 권한이 필요합니다.");
        currentUsers.requireSiteAccess(actor, siteId);
        if ((collectionIntervalMinutes == null) != (missingCollectionThreshold == null)) {
            throw new BadRequestException("수집 주기와 연속 누락 기준을 함께 입력해주세요.");
        }
        if (collectionIntervalMinutes != null) {
            validateCollectionPolicy(collectionIntervalMinutes, missingCollectionThreshold);
            noDataMinutes = collectionIntervalMinutes * missingCollectionThreshold;
        }
        if (Boolean.TRUE.equals(alertsEnabled) && !currentUsers.visibleSiteIds(actor).contains(siteId)) {
            throw new BadRequestException("대시보드에 표시되는 사업장만 알림을 켤 수 있습니다.");
        }
        if (updates == null || updates.isEmpty()) throw new BadRequestException("변경할 기준값이 없습니다.");
        if ((noDataMinutes == null) != (noDataActive == null)) {
            throw new BadRequestException("수신 중단 알림 설정을 확인해주세요.");
        }
        if (noDataMinutes != null && (noDataMinutes < 5 || noDataMinutes > 1440)) {
            throw new BadRequestException("수신 중단 기준은 5분에서 1440분 사이여야 합니다.");
        }
        if (alertsEnabled == null || triggerAfterMinutes == null || repeatMinutes == null || suppressWeekends == null) {
            throw new BadRequestException("알림 운영 설정을 확인해주세요.");
        }
        if (triggerAfterMinutes < 0 || triggerAfterMinutes > 1440) {
            throw new BadRequestException("이상 지속 기준은 0분에서 1440분 사이여야 합니다.");
        }
        if (repeatMinutes < 0 || repeatMinutes > 10080 || (repeatMinutes > 0 && repeatMinutes < 5)) {
            throw new BadRequestException("반복 알림은 사용 안 함(0) 또는 5분에서 10080분 사이여야 합니다.");
        }
        if ((quietStart == null) != (quietEnd == null)) {
            throw new BadRequestException("알림 제외 시간의 시작과 종료를 모두 입력해주세요.");
        }
        if (quietStart != null && quietStart.equals(quietEnd)) {
            throw new BadRequestException("발송 제외 시작과 종료는 다르게 지정해주세요. 항상 받으려면 야간 발송 제외를 해제하세요.");
        }
        if (holidayDates == null || holidayDates.size() > 100 || holidayDates.stream().anyMatch(java.util.Objects::isNull)) {
            throw new BadRequestException("휴일은 사업장별 최대 100일까지 등록할 수 있습니다.");
        }
        Set<String> seen = new LinkedHashSet<>();
        for (ThresholdUpdate update : updates) {
            Metric metric = METRIC_BY_KEY.get(update.key());
            if (metric == null) throw new BadRequestException("지원하지 않는 측정항목입니다: " + update.key());
            if (!seen.add(update.key())) throw new BadRequestException("중복된 측정항목입니다: " + update.key());
            validateThreshold(update.min(), update.max());
            if ((update.useAverage() == null) != (update.tolerancePercent() == null) ||
                (update.tolerancePercent() != null && (!Double.isFinite(update.tolerancePercent()) ||
                    update.tolerancePercent() < 0.1 || update.tolerancePercent() > 100))) {
                throw new BadRequestException("자동 평균의 허용편차는 0.1%에서 100% 사이여야 합니다.");
            }
        }
        jdbcTemplate.update("INSERT IGNORE INTO alert_settings (siteid) VALUES (?)", siteId);
        for (ThresholdUpdate update : updates) {
            Metric metric = METRIC_BY_KEY.get(update.key());
            String prefix = metric.storagePrefix();
            jdbcTemplate.update("UPDATE alert_settings SET " + prefix + "_min=?," + prefix + "_max=?," +
                    prefix + "_active=?,updated_at=CURRENT_TIMESTAMP WHERE siteid=?",
                update.min(), update.max(), update.active(), siteId);
            if (update.useAverage() != null) {
                jdbcTemplate.update("""
                    INSERT INTO site_metric_average_policy (site_id,metric_key,use_average,tolerance_percent)
                    VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE use_average=VALUES(use_average),
                        tolerance_percent=VALUES(tolerance_percent),updated_at=CURRENT_TIMESTAMP(6)
                    """, siteId, update.key(), update.useAverage(), update.tolerancePercent());
            }
            if (!update.active()) alertEvents.disableRule(siteId, update.key());
        }
        if (noDataMinutes != null) {
            jdbcTemplate.update("""
                INSERT INTO alert_rule
                    (site_id,metric_key,rule_type,no_data_minutes,severity,is_enabled,created_at,updated_at)
                VALUES (?,'__data__','NO_DATA',?,'WARNING',?,CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6))
                ON DUPLICATE KEY UPDATE no_data_minutes=VALUES(no_data_minutes),
                    severity=VALUES(severity),is_enabled=VALUES(is_enabled),updated_at=CURRENT_TIMESTAMP(6)
                """, siteId, noDataMinutes, noDataActive);
            if (!noDataActive) alertEvents.disableNoDataRule(siteId);
        }
        jdbcTemplate.update("""
            INSERT INTO site_alert_policy
                (site_id,is_enabled,trigger_after_minutes,repeat_minutes,quiet_start,quiet_end,
                 suppress_weekends,created_at,updated_at)
            VALUES (?,?,?,?,?,?,?,CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6))
            ON DUPLICATE KEY UPDATE is_enabled=VALUES(is_enabled),
                trigger_after_minutes=VALUES(trigger_after_minutes),repeat_minutes=VALUES(repeat_minutes),
                quiet_start=VALUES(quiet_start),quiet_end=VALUES(quiet_end),
                suppress_weekends=VALUES(suppress_weekends),updated_at=CURRENT_TIMESTAMP(6)
            """, siteId, alertsEnabled, triggerAfterMinutes, repeatMinutes, time(quietStart), time(quietEnd),
            suppressWeekends);
        if (!alertsEnabled) alertEvents.disableSite(siteId);
        if (coldChillerActive != null) {
            jdbcTemplate.update("UPDATE site_alert_policy SET cold_chiller_active=? WHERE site_id=?", coldChillerActive, siteId);
            if (!coldChillerActive) alertEvents.disableRule(siteId, "__cold_chiller__");
        }
        if (collectionIntervalMinutes != null) {
            jdbcTemplate.update("UPDATE site_alert_policy SET collection_interval_minutes=?,missing_collection_threshold=? WHERE site_id=?",
                collectionIntervalMinutes, missingCollectionThreshold, siteId);
        } else if (noDataMinutes != null) {
            // Backward-compatible clients send the legacy minute threshold only.
            jdbcTemplate.update("UPDATE site_alert_policy SET missing_collection_threshold=GREATEST(1,CEIL(?/collection_interval_minutes)) WHERE site_id=?",
                noDataMinutes, siteId);
        }
        jdbcTemplate.update("DELETE FROM site_alert_holiday WHERE site_id=?", siteId);
        holidayDates.stream().distinct().sorted().forEach(date -> jdbcTemplate.update(
            "INSERT INTO site_alert_holiday (site_id,holiday_date,created_at) VALUES (?,?,CURRENT_TIMESTAMP(6))",
            siteId, java.sql.Date.valueOf(date)));
        audit.record(actor, "ALERT_THRESHOLDS_UPDATED", "SITE", siteId,
            Map.of("thresholds", updates.stream().map(update -> Map.of(
                    "key", update.key(), "min", update.min(), "max", update.max(), "active", update.active())).toList(),
                "noDataMinutes", noDataMinutes == null ? 30 : noDataMinutes,
                "noDataActive", noDataActive != null && noDataActive,
                "alertsEnabled", alertsEnabled,
                "triggerAfterMinutes", triggerAfterMinutes,
                "repeatMinutes", repeatMinutes,
                "suppressWeekends", suppressWeekends,
                "holidayCount", holidayDates.size(),
                "coldChillerActive", coldChillerActive == null ? "UNCHANGED" : coldChillerActive,
                "collectionPolicy", collectionIntervalMinutes == null ? "LEGACY_MINUTES" :
                    Map.of("intervalMinutes", collectionIntervalMinutes, "missingThreshold", missingCollectionThreshold)));
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

    static void validateCollectionPolicy(int interval, int misses) {
        if (interval < 5 || interval > 1440 || misses < 1 || misses > 288 || (long) interval * misses > 1440) {
            throw new BadRequestException("수집 주기는 5~1440분, 누락 기준은 1~288회이며 총 대기시간은 1440분 이하여야 합니다.");
        }
    }

    private SiteAlertSettings settings(String siteId) {
        Map<Long, Map<String, AlertThreshold>> companyDefaults = companyDefaults();
        Map<String, Map<String, RollingAverageService.AverageState>> averageStates = averages.states();
        return jdbcTemplate.queryForObject("""
            SELECT a.*, s.site AS registered_site, s.name,cs.company_id,cs.is_dashboard_visible,
                   nd.no_data_minutes,nd.is_enabled AS no_data_active,
                   p.is_enabled AS alerts_enabled,p.trigger_after_minutes,p.repeat_minutes,
                   p.quiet_start,p.quiet_end,p.suppress_weekends,p.cold_chiller_active,p.collection_interval_minutes,p.missing_collection_threshold
              FROM site s LEFT JOIN alert_settings a ON a.siteid=s.site
              LEFT JOIN company_site cs ON cs.site_id=s.site
              LEFT JOIN alert_rule nd ON nd.site_id=s.site AND nd.metric_key='__data__'
                                      AND nd.rule_type='NO_DATA'
              LEFT JOIN site_alert_policy p ON p.site_id=s.site
             WHERE s.site=?
            """, (rs, row) -> settings(rs.getString("registered_site"), rs.getString("name"),
                rs.getObject("id") != null, field -> rs.getString(field), field -> rs.getObject(field),
                rs.getObject("no_data_minutes") == null ? 30 : rs.getInt("no_data_minutes"),
                rs.getObject("no_data_active") != null && rs.getBoolean("no_data_active"),
                rs.getObject("alerts_enabled") == null || rs.getBoolean("alerts_enabled"),
                rs.getObject("trigger_after_minutes") == null ? 0 : rs.getInt("trigger_after_minutes"),
                rs.getObject("repeat_minutes") == null ? 30 : rs.getInt("repeat_minutes"),
                localTime(rs.getTime("quiet_start")), localTime(rs.getTime("quiet_end")),
                rs.getObject("suppress_weekends") != null && rs.getBoolean("suppress_weekends"),
                holidayDates(siteId), rs.getObject("is_dashboard_visible") != null &&
                    rs.getBoolean("is_dashboard_visible"),
                companyDefaults.getOrDefault(rs.getLong("company_id"), Map.of()),
                averageStates.getOrDefault(siteId, Map.of()), rs.getBoolean("cold_chiller_active"),
                rs.getObject("collection_interval_minutes") == null ? 10 : rs.getInt("collection_interval_minutes"),
                rs.getObject("missing_collection_threshold") == null ? 2 : rs.getInt("missing_collection_threshold")),
            siteId);
    }

    private SiteAlertSettings settings(String siteId, String name, boolean exists,
                                       SqlStringValue strings, SqlObjectValue objects,
                                       int noDataMinutes, boolean noDataActive,
                                       boolean alertsEnabled, int triggerAfterMinutes, int repeatMinutes,
                                       LocalTime quietStart, LocalTime quietEnd,
                                       boolean suppressWeekends, List<LocalDate> holidayDates,
                                       boolean dashboardVisible,
                                       Map<String, AlertThreshold> companyDefaults,
                                       Map<String, RollingAverageService.AverageState> averageStates,
                                       boolean coldChillerActive, int collectionIntervalMinutes,
                                       int missingCollectionThreshold) throws SQLException {
        List<AlertThreshold> thresholds = new ArrayList<>();
        for (Metric metric : METRICS) {
            String prefix = metric.storagePrefix();
            Double min = DashboardService.parseNumber(strings.get(prefix + "_min"));
            Double max = DashboardService.parseNumber(strings.get(prefix + "_max"));
            AlertThreshold inherited = companyDefaults.get(metric.key());
            if (min == null) min = inherited == null ? metric.defaultMin() : inherited.min();
            if (max == null) max = inherited == null ? metric.defaultMax() : inherited.max();
            boolean active = exists ? (objects.get(prefix + "_active") == null
                || !"0".equals(strings.get(prefix + "_active"))) : inherited != null && inherited.active();
            RollingAverageService.AverageState average = averageStates.getOrDefault(metric.key(),
                RollingAverageService.AverageState.DEFAULT);
            RollingAverageService.Range range = RollingAverageService.effectiveRange(
                average, RollingAverageService.now());
            thresholds.add(new AlertThreshold(metric.key(), metric.label(), metric.unit(), min, max, active,
                range == null ? min : range.min(), range == null ? max : range.max(),
                average.useAverage(), average.tolerancePercent(), average.averageValue(),
                average.sampleCount(), average.zeroCount(), average.capturedAt(), range != null));
        }
        return new SiteAlertSettings(siteId, name, exists, thresholds, collectionIntervalMinutes * missingCollectionThreshold, noDataActive,
            alertsEnabled, triggerAfterMinutes, repeatMinutes, quietStart, quietEnd, suppressWeekends,
            holidayDates, dashboardVisible, coldChillerActive, collectionIntervalMinutes, missingCollectionThreshold);
    }

    private static Map<String, Metric> metricMap() {
        Map<String, Metric> result = new LinkedHashMap<>();
        METRICS.forEach(metric -> result.put(metric.key(), metric));
        return Map.copyOf(result);
    }

    private Map<Long, Map<String, AlertThreshold>> companyDefaults() {
        Map<Long, Map<String, AlertThreshold>> result = new LinkedHashMap<>();
        jdbcTemplate.query("SELECT company_id,metric_key,min_value,max_value,is_enabled FROM company_alert_threshold",
            (org.springframework.jdbc.core.RowCallbackHandler) rs -> {
                Metric metric = METRIC_BY_KEY.get(rs.getString("metric_key"));
                if (metric == null) return;
                result.computeIfAbsent(rs.getLong("company_id"), ignored -> new LinkedHashMap<>())
                    .put(metric.key(), new AlertThreshold(metric.key(), metric.label(), metric.unit(),
                        rs.getDouble("min_value"), rs.getDouble("max_value"), rs.getBoolean("is_enabled")));
            });
        return result;
    }

    private static Time time(LocalTime value) { return value == null ? null : Time.valueOf(value); }
    private static LocalTime localTime(Time value) { return value == null ? null : value.toLocalTime(); }

    private Map<String, List<LocalDate>> holidayDates() {
        Map<String, List<LocalDate>> result = new LinkedHashMap<>();
        jdbcTemplate.query("SELECT site_id,holiday_date FROM site_alert_holiday ORDER BY site_id,holiday_date",
            (org.springframework.jdbc.core.RowCallbackHandler) rs -> result
                .computeIfAbsent(rs.getString("site_id"), ignored -> new ArrayList<>())
                .add(rs.getDate("holiday_date").toLocalDate()));
        return result;
    }

    private List<LocalDate> holidayDates(String siteId) {
        List<LocalDate> result = jdbcTemplate.query("SELECT holiday_date FROM site_alert_holiday WHERE site_id=? ORDER BY holiday_date",
            (rs, row) -> rs.getDate(1).toLocalDate(), siteId);
        return result == null ? List.of() : result;
    }

    @FunctionalInterface private interface SqlStringValue { String get(String field) throws SQLException; }
    @FunctionalInterface private interface SqlObjectValue { Object get(String field) throws SQLException; }
    private record Metric(String key, String storagePrefix, String label, String unit,
                          double defaultMin, double defaultMax) {}
    public record ThresholdUpdate(String key, Double min, Double max, boolean active,
                                  Boolean useAverage, Double tolerancePercent) {
        public ThresholdUpdate(String key, Double min, Double max, boolean active) {
            this(key, min, max, active, null, null);
        }
    }
}
