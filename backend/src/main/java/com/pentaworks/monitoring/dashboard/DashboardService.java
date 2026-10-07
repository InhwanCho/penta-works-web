package com.pentaworks.monitoring.dashboard;

import com.pentaworks.monitoring.alert.RollingAverageService;
import com.pentaworks.monitoring.dashboard.DashboardResponse.CtrlRange;
import com.pentaworks.monitoring.dashboard.DashboardResponse.DashboardRow;
import com.pentaworks.monitoring.dashboard.DashboardResponse.Meta;
import com.pentaworks.monitoring.dashboard.DashboardResponse.Stats;
import com.pentaworks.monitoring.dashboard.DashboardResponse.AlertIssue;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class DashboardService {
    private static final Logger log = LoggerFactory.getLogger(DashboardService.class);
    private static final List<String> METRICS = List.of("recosi", "coldtp", "recoru", "hepres", "heleve", "actemp", "achumi", "gctemp", "gcflow", "cctemp", "ccflow");
    private final JdbcTemplate jdbcTemplate;
    private final RollingAverageService averages;
    private volatile DashboardResponse cachedDashboard;

    public DashboardService(JdbcTemplate jdbcTemplate, RollingAverageService averages) {
        this.jdbcTemplate = jdbcTemplate;
        this.averages = averages;
    }

    public DashboardResponse getDashboard() {
        DashboardResponse cached = cachedDashboard;
        if (cached != null) return cached;
        synchronized (this) {
            if (cachedDashboard == null) cachedDashboard = loadDashboard();
            return cachedDashboard;
        }
    }

    public DashboardResponse getDashboard(Set<String> allowedSiteIds) {
        DashboardResponse all = getDashboard();
        List<DashboardRow> rows = all.rows().stream()
            .filter(row -> allowedSiteIds.contains(row.siteDb()))
            .toList();
        Instant since1h = Instant.ofEpochMilli(all.meta().since1hMs());
        Instant since24h = Instant.ofEpochMilli(all.meta().since24hMs());
        int active1h = (int) rows.stream().filter(row -> after(row.lastAt(), since1h)).count();
        int active24h = (int) rows.stream().filter(row -> after(row.lastAt(), since24h)).count();
        int total24h = rows.stream().mapToInt(DashboardRow::count24h).sum();
        int normalSites = (int) rows.stream().filter(row -> "NORMAL".equals(row.alertStatus())).count();
        int warningSites = (int) rows.stream().filter(row -> "WARNING".equals(row.alertStatus())).count();
        int noDataSites = (int) rows.stream().filter(row -> "NO_DATA".equals(row.alertStatus())).count();
        int openAlerts = rows.stream().mapToInt(DashboardRow::openAlertCount).sum();
        Map<String, CtrlRange> ctrl = all.ctrl().entrySet().stream()
            .filter(entry -> allowedSiteIds.contains(entry.getKey()))
            .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue,
                (left, right) -> left, LinkedHashMap::new));
        return new DashboardResponse(all.meta(),
            new Stats(rows.size(), active1h, rows.size() - active24h, total24h,
                normalSites, warningSites, noDataSites, openAlerts), rows, ctrl,
            allowedSiteIds.contains("000") ? all.ctrlDefault() : null);
    }

    public void invalidateCache() {
        cachedDashboard = null;
    }

    public DashboardResponse getDashboard(Set<String> allowedSiteIds, long userId) {
        DashboardResponse scoped = getDashboard(allowedSiteIds);
        Set<Long> acknowledged = new java.util.HashSet<>(jdbcTemplate.query(
            "SELECT event_id FROM alert_event_acknowledgement WHERE user_id=?",
            (rs, row) -> rs.getLong(1), userId));
        List<DashboardRow> rows = scoped.rows().stream().map(row -> {
            List<AlertIssue> issues = row.alertIssues().stream().map(issue -> new AlertIssue(
                issue.id(), issue.metricKey(), issue.eventType(), issue.message(), issue.occurredAt(),
                acknowledged.contains(issue.id()))).toList();
            return new DashboardRow(row.siteDb(), row.siteSlug(), row.name(), row.lastAt(), row.lagMin(),
                row.count1h(), row.count24h(), row.hePsi(), row.hePct(), row.metrics(), row.alertStatus(),
                row.openAlertCount(), (int) issues.stream().filter(issue -> !issue.acknowledged()).count(), issues,
                row.collectionIntervalMinutes(), row.missingCollectionThreshold(), row.missedCollectionCount());
        }).toList();
        return new DashboardResponse(scoped.meta(), scoped.stats(), rows, scoped.ctrl(), scoped.ctrlDefault());
    }

    private static boolean after(String value, Instant threshold) {
        return value != null && Instant.parse(value).isAfter(threshold);
    }

    @EventListener(ApplicationReadyEvent.class)
    @Scheduled(fixedDelayString = "${app.dashboard.refresh-ms:10000}")
    public void refreshDashboardCache() {
        try {
            DashboardResponse next = loadDashboard();
            cachedDashboard = next;
        } catch (Exception error) {
            log.warn("Dashboard cache refresh failed; serving the last successful snapshot", error);
        }
    }

    private DashboardResponse loadDashboard() {
        Instant now = Instant.now();
        Instant since1h = now.minus(Duration.ofHours(1));
        Instant since24h = now.minus(Duration.ofHours(24));
        List<Site> sites = jdbcTemplate.query("SELECT site, name FROM site ORDER BY site", (rs, row) -> new Site(rs.getString(1), rs.getString(2)));
        Map<String, int[]> collectionPolicies = new HashMap<>();
        jdbcTemplate.query("SELECT site_id,collection_interval_minutes,missing_collection_threshold FROM site_alert_policy",
            (RowCallbackHandler) rs -> collectionPolicies.put(rs.getString(1), new int[]{rs.getInt(2), rs.getInt(3)}));

        Map<String, Counts> counts = new HashMap<>();
        jdbcTemplate.query("""
            SELECT siteid, SUM(date >= ?) AS count_1h, COUNT(*) AS count_24h
              FROM mrtb
             WHERE siteid IS NOT NULL AND date >= ?
             GROUP BY siteid
            """, (RowCallbackHandler) rs -> counts.put(rs.getString("siteid"),
                new Counts(rs.getInt("count_1h"), rs.getInt("count_24h"))), since1h, since24h);

        Map<String, Latest> latestBySite = new HashMap<>();
        jdbcTemplate.query("""
            SELECT m.siteid, m.date, m.recosi_value AS recosi, m.coldtp_value AS coldtp,
                   m.recoru_value AS recoru, m.hepres_value AS hepres, m.heleve_value AS heleve,
                   m.actemp_value AS actemp, m.achumi_value AS achumi, m.gctemp_value AS gctemp,
                   m.gcflow_value AS gcflow, m.cctemp_value AS cctemp, m.ccflow_value AS ccflow
              FROM mrtb m
              JOIN (
                    SELECT siteid, MAX(`index`) AS max_index
                      FROM mrtb
                     WHERE siteid IS NOT NULL AND date IS NOT NULL
                     GROUP BY siteid
                   ) latest ON latest.siteid=m.siteid AND latest.max_index=m.`index`
            """, (RowCallbackHandler) rs -> latestBySite.put(rs.getString("siteid"),
                new Latest(rs.getTimestamp("date").toInstant(), metricMap(rs))));

        Map<String, List<AlertIssue>> issuesBySite = new HashMap<>();
        jdbcTemplate.query("""
            SELECT e.id,e.site_id,r.metric_key,e.event_type,e.message,e.occurred_at,e.acknowledged_at
              FROM alert_event e
              JOIN alert_rule r ON r.id=e.rule_id
             WHERE r.user_id=0 AND e.recovered_at IS NULL AND e.event_type IN ('LOW','HIGH','NO_DATA','METRIC_MISSING')
             ORDER BY e.occurred_at DESC,e.id DESC
            """, (RowCallbackHandler) rs -> issuesBySite.computeIfAbsent(rs.getString("site_id"), ignored -> new ArrayList<>())
                .add(new AlertIssue(rs.getLong("id"), rs.getString("metric_key"), rs.getString("event_type"),
                    rs.getString("message"), rs.getTimestamp("occurred_at").toInstant().toString(),
                    rs.getTimestamp("acknowledged_at") != null)));

        Map<String, CtrlRange> ctrl = new LinkedHashMap<>();
        Map<String, Map<String, RollingAverageService.AverageState>> averageStates = averages.states();
        Map<String, Map<String, double[]>> inheritedRanges = new HashMap<>();
        jdbcTemplate.query("""
            SELECT cs.site_id,t.metric_key,t.min_value,t.max_value
              FROM company_site cs JOIN company_alert_threshold t ON t.company_id=cs.company_id
            """, (RowCallbackHandler) rs -> inheritedRanges
                .computeIfAbsent(rs.getString("site_id"), ignored -> new HashMap<>())
                .put(rs.getString("metric_key"), new double[] {rs.getDouble("min_value"), rs.getDouble("max_value")}));
        jdbcTemplate.query("""
            SELECT s.site,
                   a.psi_min AS mrplel, a.psi_max AS mrpleh,
                   a.he_min AS mrlevl, a.he_max AS mrlevh,
                   a.si410_min AS recosil, a.si410_max AS recosih,
                   a.chtemp_min AS coldtpl, a.chtemp_max AS coldtph,
                   a.rou_min AS recorul, a.rou_max AS recoruh,
                   a.actemp_min AS actmpl, a.actemp_max AS actmph,
                   a.achumi_min AS achuml, a.achumi_max AS achumh,
                   a.gctemp_min AS gctmpl, a.gctemp_max AS gctmph,
                   a.gcflow_min AS gcflol, a.gcflow_max AS gcfloh,
                   a.cctemp_min AS cctmpl, a.cctemp_max AS cctmph,
                   a.ccflow_min AS ccflol, a.ccflow_max AS ccfloh
              FROM site s
              LEFT JOIN alert_settings a ON a.siteid=s.site
             ORDER BY s.site
            """, (RowCallbackHandler) rs -> ctrl.put(rs.getString("site"),
                ctrlRange(rs, inheritedRanges.getOrDefault(rs.getString("site"), Map.of()),
                    averageStates.getOrDefault(rs.getString("site"), Map.of()))));
        List<DashboardRow> rows = new ArrayList<>();
        for (Site site : sites) {
            Counts count = counts.get(site.id());
            Latest latest = latestBySite.get(site.id());
            Instant lastAt = latest == null ? null : latest.lastAt();
            Long lagMinutes = lastAt == null ? null : Math.max(0, Duration.between(lastAt, now).toMinutes());
            int[] collectionPolicy = collectionPolicies.getOrDefault(site.id(), new int[]{10, 2});
            Map<String, Double> values = latest == null ? emptyMetrics() : latest.metrics();
            List<AlertIssue> issues = issuesBySite.getOrDefault(site.id(), List.of());
            String alertStatus = issues.stream().anyMatch(issue -> "NO_DATA".equals(issue.eventType()))
                ? "NO_DATA" : issues.isEmpty() ? "NORMAL" : "WARNING";
            int unacknowledged = (int) issues.stream().filter(issue -> !issue.acknowledged()).count();
            rows.add(new DashboardRow(site.id(), siteSlug(site.id()), site.name(), lastAt == null ? null : lastAt.toString(),
                lagMinutes,
                count == null ? 0 : count.count1h(), count == null ? 0 : count.count24h(), values.get("hepres"), values.get("heleve"), values,
                alertStatus, issues.size(), unacknowledged, issues, collectionPolicy[0], collectionPolicy[1],
                com.pentaworks.monitoring.alert.CollectionHealth.missedCount(lagMinutes, collectionPolicy[0])));
        }
        rows.sort(Comparator.comparingLong((DashboardRow row) ->
            row.lastAt() == null ? 0L : Instant.parse(row.lastAt()).toEpochMilli()).reversed());
        int active1h = (int) rows.stream().filter(row -> row.lastAt() != null && Instant.parse(row.lastAt()).isAfter(since1h)).count();
        int active24h = (int) rows.stream().filter(row -> row.lastAt() != null && Instant.parse(row.lastAt()).isAfter(since24h)).count();
        int total24h = rows.stream().mapToInt(DashboardRow::count24h).sum();
        int normalSites = (int) rows.stream().filter(row -> "NORMAL".equals(row.alertStatus())).count();
        int warningSites = (int) rows.stream().filter(row -> "WARNING".equals(row.alertStatus())).count();
        int noDataSites = (int) rows.stream().filter(row -> "NO_DATA".equals(row.alertStatus())).count();
        int openAlerts = rows.stream().mapToInt(DashboardRow::openAlertCount).sum();
        return new DashboardResponse(new Meta(now.toEpochMilli(), since1h.toEpochMilli(), since24h.toEpochMilli()),
            new Stats(rows.size(), active1h, rows.size() - active24h, total24h,
                normalSites, warningSites, noDataSites, openAlerts), rows, ctrl, ctrl.get("000"));
    }

    /** Read actual collection records, never scheduler ticks. Index matches the dashboard latest record. */
    public List<MetricSample> recentMetricSamples(String siteId, int limit) {
        return jdbcTemplate.query("SELECT `index`,date," + METRICS.stream().map(k->k+"_value AS "+k).collect(Collectors.joining(",")) +
            " FROM mrtb WHERE siteid=? AND date IS NOT NULL ORDER BY `index` DESC LIMIT ?",
            (rs,n)->new MetricSample(rs.getTimestamp("date").toInstant(),metricMap(rs)),siteId,Math.min(576,Math.max(1,limit)));
    }
    public record MetricSample(Instant at, Map<String,Double> metrics) {}

    private Map<String, Double> metricMap(ResultSet rs) throws SQLException {
        Map<String, Double> result = new LinkedHashMap<>();
        for (String metric : METRICS) result.put(metric, parseMeasurement(rs.getString(metric)));
        return result;
    }

    private Map<String, Double> emptyMetrics() {
        Map<String, Double> result = new LinkedHashMap<>();
        for (String metric : METRICS) result.put(metric, null);
        return result;
    }

    private CtrlRange ctrlRange(ResultSet rs, Map<String, double[]> inherited,
                                Map<String, RollingAverageService.AverageState> averageStates) throws SQLException {
        return new CtrlRange(number(rs, "recosil", inherited, averageStates, "recosi", 0), number(rs, "recosih", inherited, averageStates, "recosi", 1),
            number(rs, "coldtpl", inherited, averageStates, "coldtp", 0), number(rs, "coldtph", inherited, averageStates, "coldtp", 1),
            number(rs, "recorul", inherited, averageStates, "recoru", 0), number(rs, "recoruh", inherited, averageStates, "recoru", 1),
            number(rs, "mrplel", inherited, averageStates, "hepres", 0), number(rs, "mrpleh", inherited, averageStates, "hepres", 1),
            number(rs, "mrlevl", inherited, averageStates, "heleve", 0), number(rs, "mrlevh", inherited, averageStates, "heleve", 1),
            number(rs, "actmpl", inherited, averageStates, "actemp", 0), number(rs, "actmph", inherited, averageStates, "actemp", 1),
            number(rs, "achuml", inherited, averageStates, "achumi", 0), number(rs, "achumh", inherited, averageStates, "achumi", 1),
            number(rs, "gctmpl", inherited, averageStates, "gctemp", 0), number(rs, "gctmph", inherited, averageStates, "gctemp", 1),
            number(rs, "gcflol", inherited, averageStates, "gcflow", 0), number(rs, "gcfloh", inherited, averageStates, "gcflow", 1),
            number(rs, "cctmpl", inherited, averageStates, "cctemp", 0), number(rs, "cctmph", inherited, averageStates, "cctemp", 1),
            number(rs, "ccflol", inherited, averageStates, "ccflow", 0), number(rs, "ccfloh", inherited, averageStates, "ccflow", 1));
    }

    private Double number(ResultSet rs, String field, Map<String, double[]> inherited,
                          Map<String, RollingAverageService.AverageState> averageStates,
                          String metric, int side) throws SQLException {
        RollingAverageService.Range dynamic = RollingAverageService.effectiveRange(
            averageStates.get(metric), RollingAverageService.now());
        if (dynamic != null) return side == 0 ? dynamic.min() : dynamic.max();
        Double saved = parseNumber(rs.getString(field));
        if (saved != null) return saved;
        double[] range = inherited.get(metric);
        return range == null ? null : range[side];
    }
    public static Double parseNumber(String value) {
        if (value == null || value.isBlank()) return null;
        String cleaned = value.trim().replaceAll("[^\\d.+-]", "");
        if (cleaned.isBlank()) return null;
        try { return Double.valueOf(cleaned); } catch (NumberFormatException error) { return null; }
    }
    public static Double parseMeasurement(String value) {
        Double parsed = parseNumber(value);
        return isUnmeasured(parsed) ? null : parsed;
    }
    public static boolean isUnmeasured(Double value) {
        return value != null && (value <= 0.0 || value == 0.001 || value == 0.01 || value == 0.1);
    }
    private static String siteSlug(String id) { return id.matches("\\d+") ? String.valueOf(Integer.parseInt(id)) : id; }
    private record Site(String id, String name) {}
    private record Counts(int count1h, int count24h) {}
    private record Latest(Instant lastAt, Map<String, Double> metrics) {}
}
