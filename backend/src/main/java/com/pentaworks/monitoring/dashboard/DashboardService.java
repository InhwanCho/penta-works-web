package com.pentaworks.monitoring.dashboard;

import com.pentaworks.monitoring.dashboard.DashboardResponse.CtrlRange;
import com.pentaworks.monitoring.dashboard.DashboardResponse.DashboardRow;
import com.pentaworks.monitoring.dashboard.DashboardResponse.Meta;
import com.pentaworks.monitoring.dashboard.DashboardResponse.Stats;
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
    private volatile DashboardResponse cachedDashboard;

    public DashboardService(JdbcTemplate jdbcTemplate) { this.jdbcTemplate = jdbcTemplate; }

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
        Map<String, CtrlRange> ctrl = all.ctrl().entrySet().stream()
            .filter(entry -> "000".equals(entry.getKey()) || allowedSiteIds.contains(entry.getKey()))
            .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue,
                (left, right) -> left, LinkedHashMap::new));
        return new DashboardResponse(all.meta(),
            new Stats(rows.size(), active1h, rows.size() - active24h, total24h), rows, ctrl, all.ctrlDefault());
    }

    public void invalidateCache() {
        cachedDashboard = null;
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
            SELECT m.siteid, m.date, m.recosi, m.coldtp, m.recoru, m.hepres, m.heleve,
                   m.actemp, m.achumi, m.gctemp, m.gcflow, m.cctemp, m.ccflow
              FROM mrtb m
              JOIN (
                    SELECT siteid, MAX(`index`) AS max_index
                      FROM mrtb
                     WHERE siteid IS NOT NULL AND date IS NOT NULL
                     GROUP BY siteid
                   ) latest ON latest.siteid=m.siteid AND latest.max_index=m.`index`
            """, (RowCallbackHandler) rs -> latestBySite.put(rs.getString("siteid"),
                new Latest(rs.getTimestamp("date").toInstant(), metricMap(rs))));

        Map<String, CtrlRange> ctrl = new LinkedHashMap<>();
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
            """, (RowCallbackHandler) rs -> ctrl.put(rs.getString("site"), ctrlRange(rs)));
        List<DashboardRow> rows = new ArrayList<>();
        for (Site site : sites) {
            Counts count = counts.get(site.id());
            Latest latest = latestBySite.get(site.id());
            Instant lastAt = latest == null ? null : latest.lastAt();
            Map<String, Double> values = latest == null ? emptyMetrics() : latest.metrics();
            rows.add(new DashboardRow(site.id(), siteSlug(site.id()), site.name(), lastAt == null ? null : lastAt.toString(),
                lastAt == null ? null : Math.max(0, Duration.between(lastAt, now).toMinutes()),
                count == null ? 0 : count.count1h(), count == null ? 0 : count.count24h(), values.get("hepres"), values.get("heleve"), values));
        }
        rows.sort(Comparator.comparingLong((DashboardRow row) ->
            row.lastAt() == null ? 0L : Instant.parse(row.lastAt()).toEpochMilli()).reversed());
        int active1h = (int) rows.stream().filter(row -> row.lastAt() != null && Instant.parse(row.lastAt()).isAfter(since1h)).count();
        int active24h = (int) rows.stream().filter(row -> row.lastAt() != null && Instant.parse(row.lastAt()).isAfter(since24h)).count();
        int total24h = rows.stream().mapToInt(DashboardRow::count24h).sum();
        return new DashboardResponse(new Meta(now.toEpochMilli(), since1h.toEpochMilli(), since24h.toEpochMilli()),
            new Stats(rows.size(), active1h, rows.size() - active24h, total24h), rows, ctrl, ctrl.get("000"));
    }

    private Map<String, Double> metricMap(ResultSet rs) throws SQLException {
        Map<String, Double> result = new LinkedHashMap<>();
        for (String metric : METRICS) result.put(metric, parseNumber(rs.getString(metric)));
        return result;
    }

    private Map<String, Double> emptyMetrics() {
        Map<String, Double> result = new LinkedHashMap<>();
        for (String metric : METRICS) result.put(metric, null);
        return result;
    }

    private CtrlRange ctrlRange(ResultSet rs) throws SQLException {
        return new CtrlRange(number(rs, "recosil"), number(rs, "recosih"), number(rs, "coldtpl"), number(rs, "coldtph"),
            number(rs, "recorul"), number(rs, "recoruh"),
            number(rs, "mrplel"), number(rs, "mrpleh"), number(rs, "mrlevl"), number(rs, "mrlevh"),
            number(rs, "actmpl"), number(rs, "actmph"), number(rs, "achuml"), number(rs, "achumh"),
            number(rs, "gctmpl"), number(rs, "gctmph"), number(rs, "gcflol"), number(rs, "gcfloh"),
            number(rs, "cctmpl"), number(rs, "cctmph"), number(rs, "ccflol"), number(rs, "ccfloh"));
    }

    private Double number(ResultSet rs, String field) throws SQLException { return parseNumber(rs.getString(field)); }
    public static Double parseNumber(String value) {
        if (value == null || value.isBlank()) return null;
        String cleaned = value.trim().replaceAll("[^\\d.+-]", "");
        if (cleaned.isBlank()) return null;
        try { return Double.valueOf(cleaned); } catch (NumberFormatException error) { return null; }
    }
    private static String siteSlug(String id) { return id.matches("\\d+") ? String.valueOf(Integer.parseInt(id)) : id; }
    private record Site(String id, String name) {}
    private record Counts(int count1h, int count24h) {}
    private record Latest(Instant lastAt, Map<String, Double> metrics) {}
}
