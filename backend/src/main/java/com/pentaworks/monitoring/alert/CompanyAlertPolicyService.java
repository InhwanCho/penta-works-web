package com.pentaworks.monitoring.alert;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pentaworks.monitoring.admin.AuditService;
import com.pentaworks.monitoring.auth.CurrentUserService;
import com.pentaworks.monitoring.auth.CurrentUserService.CurrentUser;
import com.pentaworks.monitoring.common.BadRequestException;
import com.pentaworks.monitoring.common.ConflictException;
import com.pentaworks.monitoring.common.ForbiddenException;
import com.pentaworks.monitoring.dashboard.DashboardService;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CompanyAlertPolicyService {
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private static final Set<String> AVERAGE_METRICS = Set.of("hepres", "heleve", "gctemp", "cctemp", "ccflow", "actemp", "achumi");
    private final JdbcTemplate db;
    private final ObjectMapper json;
    private final CurrentUserService users;
    private final AuditService audit;
    private final Map<String, AverageCache> pressureAverages = new ConcurrentHashMap<>();
    public CompanyAlertPolicyService(JdbcTemplate db, ObjectMapper json, CurrentUserService users, AuditService audit) {
        this.db = db; this.json = json; this.users = users; this.audit = audit;
    }
    public record Hospital(boolean enabled, int intervalMinutes) {}
    public record Policy(double tolerancePercent, double pressureWarning, double pressureCritical, double gradientCritical,
                         int missingWarning, int missingCritical, int collectionWarning, int collectionCritical,
                         boolean coldChillerEnabled, Map<String, Hospital> hospitals) {
        public Policy {
            if (!Double.isFinite(tolerancePercent) || tolerancePercent <= 0 || tolerancePercent > 100
                || !Double.isFinite(pressureWarning) || !Double.isFinite(pressureCritical) || !Double.isFinite(gradientCritical)
                || pressureWarning <= 0 || pressureCritical <= pressureWarning || gradientCritical <= 0
                || missingWarning < 1 || missingCritical <= missingWarning || missingCritical > 288
                || collectionWarning < 1 || collectionCritical <= collectionWarning || collectionCritical > 24)
                throw new BadRequestException("경고 기준보다 위험 기준을 높게 설정해주세요. 입력값을 확인해주세요.");
            if (hospitals == null || hospitals.values().stream().anyMatch(h -> h == null || h.intervalMinutes < 5 || h.intervalMinutes > 1440))
                throw new BadRequestException("병원 수집 주기는 5~1440분으로 입력해주세요.");
            hospitals = Map.copyOf(hospitals);
        }
        public static Policy defaults() { return new Policy(50, 2.3, 2.5, 28, 3, 6, 2, 3, true, Map.of()); }
        public Hospital hospital(String site) { return hospitals.getOrDefault(site, new Hospital(true, 10)); }
    }
    public record Saved(long revision, Policy policy) {}
    public record HospitalView(String siteId, String name, Hospital settings, LocalDate coldHeadReplacedAt, LocalDate quietUntil) {}
    public record View(long revision, Policy policy, boolean canEdit, List<HospitalView> hospitals) {}
    private record AverageCache(LocalDate reset, Instant expires, Double value, int samples) {}
    public Saved saved(long company) {
        var rows = db.query("SELECT revision,settings_json FROM company_notification_policy WHERE company_id=?",
            (rs,n) -> new Saved(rs.getLong(1), decode(rs.getString(2))), company);
        return rows.isEmpty() ? new Saved(0, Policy.defaults()) : rows.get(0);
    }
    public View view(CurrentUser actor) {
        var saved = saved(actor.companyId());
        var allowed = users.allowedSiteIds(actor);
        var replacements = replacements(actor.companyId());
        var sites = db.query("SELECT s.site,s.name FROM site s JOIN company_site c ON c.site_id=s.site WHERE c.company_id=? ORDER BY s.name",
            (rs,n) -> {
                String site = rs.getString(1);
                var date = replacements.get(site);
                return new HospitalView(site, rs.getString(2), saved.policy.hospital(site), date, date == null ? null : date.plusDays(5));
            }, actor.companyId()).stream().filter(s -> allowed.contains(s.siteId)).toList();
        // A normal member only sees hospitals assigned to them, including saved overrides.
        var overrides = new LinkedHashMap<String,Hospital>();
        saved.policy.hospitals.forEach((site,config) -> { if (allowed.contains(site)) overrides.put(site,config); });
        var p = saved.policy;
        var visible = new Policy(p.tolerancePercent,p.pressureWarning,p.pressureCritical,p.gradientCritical,p.missingWarning,p.missingCritical,
            p.collectionWarning,p.collectionCritical,p.coldChillerEnabled,overrides);
        return new View(saved.revision, visible, actor.isAdmin(), sites);
    }
    @Transactional
    public View save(CurrentUser actor, Saved input) {
        requireAdmin(actor);
        if (input == null || input.policy == null) throw new BadRequestException("설정값을 입력해주세요.");
        var allowed = users.allowedSiteIds(actor);
        if (!allowed.containsAll(input.policy.hospitals.keySet())) throw new ForbiddenException("소속 회사의 병원만 설정할 수 있습니다.");
        db.update("INSERT IGNORE INTO company_notification_policy(company_id,settings_json) VALUES(?,?)", actor.companyId(), encode(Policy.defaults()));
        int changed = db.update("UPDATE company_notification_policy SET settings_json=?,revision=revision+1 WHERE company_id=? AND revision=?",
            encode(input.policy), actor.companyId(), input.revision);
        if (changed != 1) throw new ConflictException("다른 관리자가 먼저 변경했습니다. 새로고침 후 다시 저장해주세요.");
        // Retire old incident rules that no longer have a notification condition. Existing live incidents retain their one-shot state.
        db.update("""
            UPDATE alert_event e JOIN alert_rule r ON r.id=e.rule_id JOIN app_user u ON u.id=r.user_id
            SET e.recovered_at=CURRENT_TIMESTAMP(6)
            WHERE u.company_id=? AND e.recovered_at IS NULL
              AND (r.metric_key NOT IN ('hepres','gctemp','__data__','__cold_chiller__') OR e.event_type='LOW')
            """, actor.companyId());
        if (!input.policy.coldChillerEnabled) db.update("""
            UPDATE alert_event e JOIN alert_rule r ON r.id=e.rule_id JOIN app_user u ON u.id=r.user_id
            SET e.recovered_at=CURRENT_TIMESTAMP(6) WHERE u.company_id=? AND r.metric_key='__cold_chiller__' AND e.recovered_at IS NULL
            """,actor.companyId());
        input.policy.hospitals.forEach((site,h) -> {
            if (!h.enabled) db.update("""
                UPDATE alert_event e JOIN alert_rule r ON r.id=e.rule_id JOIN app_user u ON u.id=r.user_id
                SET e.recovered_at=CURRENT_TIMESTAMP(6) WHERE u.company_id=? AND r.site_id=? AND e.recovered_at IS NULL
                """, actor.companyId(),site);
        });
        audit.record(actor, "COMPANY_ALERT_POLICY_UPDATED", "COMPANY", Long.toString(actor.companyId()), Map.of("revision",input.revision + 1));
        return view(actor);
    }
    public static void requireAdmin(CurrentUser actor) {
        if (!actor.isAdmin()) throw new ForbiddenException("회사 관리자만 알림 기준을 변경할 수 있습니다.");
    }
    private String encode(Policy p) {
        try { return json.writeValueAsString(p); } catch (JsonProcessingException e) { throw new IllegalStateException(e); }
    }
    private Policy decode(String value) {
        try { return json.readValue(value,Policy.class); } catch (JsonProcessingException e) { throw new IllegalStateException(e); }
    }
    public Map<String,LocalDate> replacements(long company) {
        Map<String,LocalDate> result = new HashMap<>();
        db.query("""
            SELECT COALESCE(h.monitoring_site_id,w.site_id) site_id,MAX(w.work_date) replaced_at
            FROM workspace_record w LEFT JOIN workspace_hospital h ON h.company_id=w.company_id AND h.site_id=w.site_id
            WHERE w.company_id=? AND w.service_type='COLDHEAD' AND w.status='COMPLETED' AND w.deleted_at IS NULL
              AND w.work_date<=? GROUP BY COALESCE(h.monitoring_site_id,w.site_id)
            """, (org.springframework.jdbc.core.RowCallbackHandler) rs -> result.put(rs.getString(1),rs.getDate(2).toLocalDate()), company, LocalDate.now(SEOUL));
        return result;
    }
    public static boolean settling(LocalDate replacement, Instant now) {
        return replacement != null && now.isBefore(replacement.plusDays(5).atStartOfDay(SEOUL).toInstant());
    }
    public boolean pressureQuiet(long company, String site, Instant now) { return settling(replacements(company).get(site),now); }
    public List<SiteAlertSettings> apply(CurrentUser actor, List<SiteAlertSettings> input) {
        var p = saved(actor.companyId()).policy;
        var replaced = replacements(actor.companyId());
        var airCooled = new HashSet<>(db.queryForList("SELECT site_id FROM site_cooling_config WHERE air_cooled=TRUE", String.class));
        return input.stream().map(site -> {
            Hospital hospital = p.hospital(site.siteid());
            var thresholds = site.thresholds().stream().map(t -> {
                boolean pressure = t.key().equals("hepres");
                Double average = t.averageValue();
                int samples = t.averageSampleCount();
                if (pressure) {
                    var baseline = pressureAverage(actor.companyId(),site.siteid(),replaced.get(site.siteid()));
                    average = baseline.value; samples = baseline.samples;
                }
                boolean enabled = AVERAGE_METRICS.contains(t.key());
                Double min = average == null ? null : average - Math.abs(average) * p.tolerancePercent / 100;
                Double max = average == null ? null : average + Math.abs(average) * p.tolerancePercent / 100;
                return new AlertThreshold(t.key(),t.label(),t.unit(),min,max,enabled,min,max,true,p.tolerancePercent,
                    average,samples,t.excludedZeroCount(),t.averageCapturedAt(),average != null,average == null ? "NO_AVERAGE" : null,
                    !pressure && t.historicalAverage(),pressure,p.missingCritical);
            }).toList();
            return new SiteAlertSettings(site.siteid(),site.name(),true,thresholds,hospital.intervalMinutes * p.collectionCritical,true,
                hospital.enabled,0,site.repeatMinutes(),site.quietStart(),site.quietEnd(),site.suppressWeekends(),site.holidayDates(),
                site.dashboardVisible(),p.coldChillerEnabled && !airCooled.contains(site.siteid()),hospital.intervalMinutes,p.collectionCritical);
        }).toList();
    }
    private AverageCache pressureAverage(long company, String site, LocalDate reset) {
        String key = company + ":" + site;
        Instant now = Instant.now();
        return pressureAverages.compute(key,(ignored, old) -> {
            if (old != null && Objects.equals(old.reset,reset) && old.expires.isAfter(now)) return old;
            LocalDateTime end = LocalDateTime.now(SEOUL), start = end.minusDays(7);
            if (reset != null && reset.atStartOfDay().isAfter(start)) start = reset.atStartOfDay();
            return db.queryForObject("""
                SELECT AVG(hepres_value),COUNT(*) FROM mrtb
                WHERE siteid=? AND date>=? AND date<=? AND hepres_unmeasured=FALSE
                  AND hepres_value>0 AND hepres_value NOT IN (0.001,0.01,0.1)
                """, (rs,n) -> new AverageCache(reset,now.plusSeconds(60),rs.getInt(2) >= 12 ? (Double)rs.getObject(1,Double.class) : null,rs.getInt(2)),
                site,Timestamp.valueOf(start),Timestamp.valueOf(end));
        });
    }
}
