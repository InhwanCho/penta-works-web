package com.pentaworks.monitoring.alert;

import com.pentaworks.monitoring.admin.AuditService;
import com.pentaworks.monitoring.auth.CurrentUserService;
import com.pentaworks.monitoring.auth.CurrentUserService.CurrentUser;
import com.pentaworks.monitoring.common.BadRequestException;
import com.pentaworks.monitoring.common.ForbiddenException;
import com.pentaworks.monitoring.dashboard.DashboardService;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AlertService {
    private final JdbcTemplate jdbcTemplate;
    private final CurrentUserService currentUsers;
    private final AuditService audit;

    public AlertService(JdbcTemplate jdbcTemplate, CurrentUserService currentUsers, AuditService audit) {
        this.jdbcTemplate = jdbcTemplate;
        this.currentUsers = currentUsers;
        this.audit = audit;
    }

    public List<PsiThreshold> psiThresholds(Set<String> allowedSiteIds) {
        return psiThresholds().stream()
            .filter(row -> allowedSiteIds.contains(row.siteid())).toList();
    }

    public List<PsiThreshold> psiThresholds() {
        return jdbcTemplate.query("""
            SELECT a.id, s.site AS siteid, s.name, a.psi_min, a.psi_max, a.psi_active
              FROM site s LEFT JOIN alert_settings a ON a.siteid = s.site
             ORDER BY s.site
            """, (rs, row) -> new PsiThreshold(rs.getString("siteid"), rs.getString("name"),
                DashboardService.parseNumber(rs.getString("psi_min")), DashboardService.parseNumber(rs.getString("psi_max")),
                rs.getObject("id") != null && (rs.getObject("psi_active") == null || rs.getInt("psi_active") != 0)));
    }

    @Transactional
    public PsiThreshold updatePsiThreshold(CurrentUser actor, String siteId, Double min, Double max, boolean active) {
        if (!actor.isAdmin()) throw new ForbiddenException("관리자 권한이 필요합니다.");
        currentUsers.requireSiteAccess(actor, siteId);
        validateThreshold(min, max);
        jdbcTemplate.update("""
            INSERT INTO alert_settings (siteid,psi_min,psi_max,psi_active,updated_at)
            VALUES (?,?,?,?,CURRENT_TIMESTAMP)
            ON DUPLICATE KEY UPDATE psi_min=VALUES(psi_min),psi_max=VALUES(psi_max),
                                    psi_active=VALUES(psi_active),updated_at=CURRENT_TIMESTAMP
            """, siteId, min, max, active);
        audit.record(actor, "PSI_THRESHOLD_UPDATED", "SITE", siteId,
            Map.of("min", min, "max", max, "active", active));
        return threshold(siteId);
    }

    static void validateThreshold(Double min, Double max) {
        if (min == null || max == null || !Double.isFinite(min) || !Double.isFinite(max)) {
            throw new BadRequestException("최소값과 최대값을 숫자로 입력해주세요.");
        }
        if (min < 0 || max < 0) throw new BadRequestException("기준값은 0 이상이어야 합니다.");
        if (min > max) throw new BadRequestException("최소값은 최대값보다 클 수 없습니다.");
    }

    private PsiThreshold threshold(String siteId) {
        return jdbcTemplate.queryForObject("""
            SELECT a.id, s.site AS siteid, s.name, a.psi_min, a.psi_max, a.psi_active
              FROM site s LEFT JOIN alert_settings a ON a.siteid=s.site
             WHERE s.site=?
            """, (rs, row) -> new PsiThreshold(rs.getString("siteid"), rs.getString("name"),
                DashboardService.parseNumber(rs.getString("psi_min")), DashboardService.parseNumber(rs.getString("psi_max")),
                rs.getObject("id") != null && (rs.getObject("psi_active") == null || rs.getInt("psi_active") != 0)),
            siteId);
    }
}
