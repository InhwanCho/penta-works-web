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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.stereotype.Service;

@Service
public class DashboardService {
    private static final List<String> METRICS = List.of("recosi", "coldtp", "recoru", "hepres", "heleve", "actemp", "achumi", "gctemp", "gcflow", "cctemp", "ccflow");
    private final JdbcTemplate jdbcTemplate;

    public DashboardService(JdbcTemplate jdbcTemplate) { this.jdbcTemplate = jdbcTemplate; }

    public DashboardResponse getDashboard() {
        Instant now = Instant.now();
        Instant since1h = now.minus(Duration.ofHours(1));
        Instant since24h = now.minus(Duration.ofHours(24));
        List<Site> sites = jdbcTemplate.query("SELECT site, name FROM site ORDER BY site", (rs, row) -> new Site(rs.getString(1), rs.getString(2)));

        Map<String, Counts> counts = new HashMap<>();
        jdbcTemplate.query("""
            SELECT siteid, MAX(date) AS last_at,
                   SUM(date >= ?) AS count_1h, SUM(date >= ?) AS count_24h
              FROM mrtb WHERE siteid IS NOT NULL AND date IS NOT NULL GROUP BY siteid
            """, (RowCallbackHandler) rs -> counts.put(rs.getString("siteid"), new Counts(
                rs.getTimestamp("last_at") == null ? null : rs.getTimestamp("last_at").toInstant(),
                rs.getInt("count_1h"), rs.getInt("count_24h"))), since1h, since24h);

        Map<String, Map<String, Double>> metrics = new HashMap<>();
        jdbcTemplate.query("""
            SELECT siteid, recosi, coldtp, recoru, hepres, heleve, actemp, achumi, gctemp, gcflow, cctemp, ccflow
            FROM (SELECT m.*, ROW_NUMBER() OVER (PARTITION BY siteid ORDER BY date DESC, `index` DESC) AS rn
                  FROM mrtb m WHERE siteid IS NOT NULL AND date IS NOT NULL) latest WHERE rn = 1
            """, (RowCallbackHandler) rs -> metrics.put(rs.getString("siteid"), metricMap(rs)));

        Map<String, CtrlRange> ctrl = new LinkedHashMap<>();
        jdbcTemplate.query("SELECT * FROM ctrl ORDER BY site", (RowCallbackHandler) rs -> ctrl.put(rs.getString("site"), ctrlRange(rs)));
        List<DashboardRow> rows = new ArrayList<>();
        for (Site site : sites) {
            Counts count = counts.get(site.id());
            Instant lastAt = count == null ? null : count.lastAt();
            Map<String, Double> values = metrics.getOrDefault(site.id(), emptyMetrics());
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
        return new CtrlRange(number(rs, "mrplel"), number(rs, "mrpleh"), number(rs, "mrlevl"), number(rs, "mrlevh"),
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
    private record Counts(Instant lastAt, int count1h, int count24h) {}
}
