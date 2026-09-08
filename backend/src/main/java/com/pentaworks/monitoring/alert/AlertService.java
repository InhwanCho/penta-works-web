package com.pentaworks.monitoring.alert;

import com.pentaworks.monitoring.dashboard.DashboardService;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class AlertService {
    private final JdbcTemplate jdbcTemplate;
    public AlertService(JdbcTemplate jdbcTemplate) { this.jdbcTemplate = jdbcTemplate; }

    public List<PsiThreshold> psiThresholds() {
        return jdbcTemplate.query("""
            SELECT a.siteid, s.name, a.psi_min, a.psi_max, a.psi_active
            FROM alert_settings a LEFT JOIN site s ON s.site = a.siteid ORDER BY a.siteid
            """, (rs, row) -> new PsiThreshold(rs.getString("siteid"), rs.getString("name"),
                DashboardService.parseNumber(rs.getString("psi_min")), DashboardService.parseNumber(rs.getString("psi_max")),
                rs.getObject("psi_active") == null || rs.getInt("psi_active") != 0));
    }
}
