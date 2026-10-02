package com.pentaworks.monitoring.site;

import com.pentaworks.monitoring.common.NotFoundException;
import com.pentaworks.monitoring.dashboard.DashboardService;
import java.util.List;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class SiteService {
    private final JdbcTemplate jdbcTemplate;
    public SiteService(JdbcTemplate jdbcTemplate) { this.jdbcTemplate = jdbcTemplate; }

    public List<SiteResponse.SiteSummary> list(Set<String> allowedSiteIds) {
        return jdbcTemplate.query("SELECT site, name FROM site ORDER BY site",
            (rs, row) -> new SiteResponse.SiteSummary(rs.getString("site"), rs.getString("name"))).stream()
            .filter(site -> allowedSiteIds.contains(site.siteDb())).toList();
    }

    public SiteResponse detail(String slug, int rawTake) {
        int take = Math.min(Math.max(rawTake, 10), 1000);
        String siteId = normalizeSiteId(slug);
        SiteResponse.SiteSummary site = jdbcTemplate.query("SELECT site, name FROM site WHERE site = ?", rs ->
            rs.next() ? new SiteResponse.SiteSummary(rs.getString("site"), rs.getString("name")) : null, siteId);
        if (site == null) throw new NotFoundException("사이트를 찾을 수 없습니다.");
        List<SiteResponse.Measurement> rows = jdbcTemplate.query("""
            SELECT `index`, date, hepres_value AS hepres, heleve_value AS heleve,
                actemp_value AS actemp, achumi_value AS achumi,
                recosi_value AS recosi, coldtp_value AS coldtp, recoru_value AS recoru,
                gctemp_value AS gctemp, gcflow_value AS gcflow,
                cctemp_value AS cctemp, ccflow_value AS ccflow FROM mrtb
            WHERE siteid = ? AND date IS NOT NULL ORDER BY date DESC, `index` DESC LIMIT ?
            """, (rs, row) -> new SiteResponse.Measurement(rs.getInt("index"),
                rs.getTimestamp("date").toInstant().toString(), DashboardService.parseMeasurement(rs.getString("hepres")),
                DashboardService.parseMeasurement(rs.getString("heleve")), DashboardService.parseMeasurement(rs.getString("actemp")),
                DashboardService.parseMeasurement(rs.getString("achumi")),
                DashboardService.parseMeasurement(rs.getString("recosi")), DashboardService.parseMeasurement(rs.getString("coldtp")),
                DashboardService.parseMeasurement(rs.getString("recoru")), DashboardService.parseMeasurement(rs.getString("gctemp")),
                DashboardService.parseMeasurement(rs.getString("gcflow")), DashboardService.parseMeasurement(rs.getString("cctemp")),
                DashboardService.parseMeasurement(rs.getString("ccflow"))), site.siteDb(), take);
        return new SiteResponse(slug, site, take, rows.isEmpty() ? null : rows.get(0).date(), rows);
    }

    public static String normalizeSiteId(String slug) {
        return slug.matches("\\d+") ? String.format("%03d", Integer.parseInt(slug)) : slug;
    }
}
