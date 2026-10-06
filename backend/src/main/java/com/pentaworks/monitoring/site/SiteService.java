package com.pentaworks.monitoring.site;

import com.pentaworks.monitoring.common.NotFoundException;
import com.pentaworks.monitoring.dashboard.DashboardService;
import java.util.List;
import java.util.Set;
import java.time.Instant;
import java.sql.Timestamp;
import java.util.ArrayList;
import com.pentaworks.monitoring.common.BadRequestException;
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
        return detail(slug, rawTake, null, null);
    }

    public SiteResponse detail(String slug, int rawTake, Instant from, Instant to) {
        return detail(slug, rawTake, from, to, 1);
    }

    public SiteResponse detail(String slug, int rawTake, Instant from, Instant to, int rawPage) {
        validatePeriod(from, to);
        int take = from == null ? Math.min(Math.max(rawTake, 10), 1000) : 5000;
        String siteId = normalizeSiteId(slug);
        SiteResponse.SiteSummary site = jdbcTemplate.query("SELECT site, name FROM site WHERE site = ?", rs ->
            rs.next() ? new SiteResponse.SiteSummary(rs.getString("site"), rs.getString("name")) : null, siteId);
        if (site == null) throw new NotFoundException("사이트를 찾을 수 없습니다.");
        long totalCount = 0;
        int page = 1;
        if (from != null) {
            Long count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM mrtb WHERE siteid=? AND date>=? AND date<=?",
                Long.class, site.siteDb(), Timestamp.from(from), Timestamp.from(to));
            totalCount = count == null ? 0 : count;
            long pages = Math.max(1, (totalCount + take - 1) / take);
            page = (int) Math.min(Math.max(1, rawPage), pages);
        }
        List<Object> arguments = new ArrayList<>();
        arguments.add(site.siteDb());
        if (from != null) {arguments.add(Timestamp.from(from)); arguments.add(Timestamp.from(to));}
        arguments.add(take);
        if (from != null) arguments.add((long) (page - 1) * take);
        List<SiteResponse.Measurement> rows = jdbcTemplate.query("""
            SELECT `index`, date, hepres_value AS hepres, heleve_value AS heleve,
                actemp_value AS actemp, achumi_value AS achumi,
                recosi_value AS recosi, coldtp_value AS coldtp, recoru_value AS recoru,
                gctemp_value AS gctemp, gcflow_value AS gcflow,
                cctemp_value AS cctemp, ccflow_value AS ccflow FROM mrtb
            WHERE siteid = ? AND date IS NOT NULL %s ORDER BY date DESC, `index` DESC LIMIT ? %s
            """.formatted(from == null ? "" : "AND date >= ? AND date <= ?", from == null ? "" : "OFFSET ?"), (rs, row) -> new SiteResponse.Measurement(rs.getInt("index"),
                rs.getTimestamp("date").toInstant().toString(), DashboardService.parseMeasurement(rs.getString("hepres")),
                DashboardService.parseMeasurement(rs.getString("heleve")), DashboardService.parseMeasurement(rs.getString("actemp")),
                DashboardService.parseMeasurement(rs.getString("achumi")),
                DashboardService.parseMeasurement(rs.getString("recosi")), DashboardService.parseMeasurement(rs.getString("coldtp")),
                DashboardService.parseMeasurement(rs.getString("recoru")), DashboardService.parseMeasurement(rs.getString("gctemp")),
                DashboardService.parseMeasurement(rs.getString("gcflow")), DashboardService.parseMeasurement(rs.getString("cctemp")),
                DashboardService.parseMeasurement(rs.getString("ccflow"))), arguments.toArray());
        String lastAt = rows.isEmpty() ? null : rows.get(0).date();
        if (from != null) lastAt = jdbcTemplate.query("SELECT date FROM mrtb WHERE siteid=? AND date IS NOT NULL ORDER BY date DESC LIMIT 1",
            rs -> rs.next() ? rs.getTimestamp(1).toInstant().toString() : null, site.siteDb());
        return new SiteResponse(slug, site, take, lastAt, rows, List.of(), page, from == null ? rows.size() : totalCount);
    }

    static void validatePeriod(Instant from, Instant to) {
        if ((from == null) != (to == null)) throw new BadRequestException("조회 시작과 종료를 함께 입력해주세요.");
        if (from != null && !from.isBefore(to))
            throw new BadRequestException("조회 종료는 시작 이후여야 합니다.");
    }

    public static String normalizeSiteId(String slug) {
        return slug.matches("\\d+") ? String.format("%03d", Integer.parseInt(slug)) : slug;
    }
}
