package com.pentaworks.monitoring.dashboard;

import com.pentaworks.monitoring.auth.CurrentUserService;
import com.pentaworks.monitoring.auth.CurrentUserService.CurrentUser;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Personal visibility controls delivery eligibility without changing assignments or saved thresholds. */
@Service
public class DashboardVisibilityService {
    private final JdbcTemplate jdbc;
    private final CurrentUserService users;

    public DashboardVisibilityService(JdbcTemplate jdbc, CurrentUserService users) {
        this.jdbc = jdbc;
        this.users = users;
    }

    public List<String> hiddenSites(CurrentUser actor) {
        var allowed = users.allowedSiteIds(actor);
        return jdbc.queryForList("SELECT site_id FROM user_dashboard_hidden_site WHERE user_id=? ORDER BY site_id",
            String.class, actor.id()).stream().filter(allowed::contains).toList();
    }

    @Transactional
    public List<String> setHidden(CurrentUser actor, String siteId, boolean hidden) {
        users.requireSiteAccess(actor, siteId);
        if (hidden) jdbc.update("INSERT IGNORE INTO user_dashboard_hidden_site(user_id,site_id) VALUES(?,?)", actor.id(), siteId);
        else jdbc.update("DELETE FROM user_dashboard_hidden_site WHERE user_id=? AND site_id=?", actor.id(), siteId);
        return hiddenSites(actor);
    }

    @Transactional
    public List<String> restoreAll(CurrentUser actor) {
        jdbc.update("DELETE FROM user_dashboard_hidden_site WHERE user_id=?", actor.id());
        return List.of();
    }
}
