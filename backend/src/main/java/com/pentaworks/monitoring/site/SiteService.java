package com.pentaworks.monitoring.site;

import com.pentaworks.monitoring.common.NotFoundException;
import com.pentaworks.monitoring.dashboard.DashboardService;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class SiteService {
    private final JdbcTemplate jdbcTemplate;
    public SiteService(JdbcTemplate jdbcTemplate) { this.jdbcTemplate = jdbcTemplate; }

    public List<SiteResponse.SiteSummary> list() {
        return jdbcTemplate.query("SELECT site, name FROM site ORDER BY site", (rs, row) -> new SiteResponse.SiteSummary(rs.getString("site"), rs.getString("name")));
    }

    public SiteResponse detail(String slug, int rawTake) {
        int take = Math.min(Math.max(rawTake, 10), 1000);
        String siteId = slug.matches("\\d+") ? String.format("%03d", Integer.parseInt(slug)) : slug;
        SiteResponse.SiteSummary site = jdbcTemplate.query("SELECT site, name FROM site WHERE site = ?", rs ->
            rs.next() ? new SiteResponse.SiteSummary(rs.getString("site"), rs.getString("name")) : null, siteId);
        if (site == null) throw new NotFoundException("사이트를 찾을 수 없습니다.");
        List<SiteResponse.Measurement> rows = jdbcTemplate.query("""
            SELECT `index`, date, hepres, heleve, actemp, achumi,
                recosi, coldtp, recoru, gctemp, gcflow, cctemp, ccflow FROM mrtb
            WHERE siteid = ? AND date IS NOT NULL ORDER BY date DESC, `index` DESC LIMIT ?
            """, (rs, row) -> new SiteResponse.Measurement(rs.getInt("index"),
                rs.getTimestamp("date").toInstant().toString(), DashboardService.parseNumber(rs.getString("hepres")),
                DashboardService.parseNumber(rs.getString("heleve")), DashboardService.parseNumber(rs.getString("actemp")),
                DashboardService.parseNumber(rs.getString("achumi")),
                DashboardService.parseNumber(rs.getString("recosi")), DashboardService.parseNumber(rs.getString("coldtp")),
                DashboardService.parseNumber(rs.getString("recoru")), DashboardService.parseNumber(rs.getString("gctemp")),
                DashboardService.parseNumber(rs.getString("gcflow")), DashboardService.parseNumber(rs.getString("cctemp")),
                DashboardService.parseNumber(rs.getString("ccflow"))), site.siteDb(), take);
        return new SiteResponse(slug, site, take, rows.isEmpty() ? null : rows.get(0).date(), rows);
    }
}
