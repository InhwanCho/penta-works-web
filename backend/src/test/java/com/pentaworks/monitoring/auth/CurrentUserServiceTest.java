package com.pentaworks.monitoring.auth;

import com.pentaworks.monitoring.auth.CurrentUserService.CurrentUser;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CurrentUserServiceTest {
    @Test
    @SuppressWarnings("unchecked")
    void superAdministratorOnlyReceivesSitesOwnedByTheirCompany() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        String sql = "SELECT site_id FROM company_site WHERE company_id=? ORDER BY site_id";
        when(jdbc.query(eq(sql), any(RowMapper.class), eq(42L))).thenReturn(List.of("001", "002"));
        CurrentUserService service = new CurrentUserService(jdbc);
        CurrentUser superAdmin = new CurrentUser(
            7, 42, "root@example.com", "Root", "SUPER_ADMIN", "ACTIVE");

        Set<String> allowed = service.allowedSiteIds(superAdmin);

        assertEquals(Set.of("001", "002"), allowed);
        verify(jdbc).query(eq(sql), any(RowMapper.class), eq(42L));
    }

    @Test
    @SuppressWarnings("unchecked")
    void dashboardSitesExcludeHiddenSitesForAdministrators() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        String sql = "SELECT site_id FROM company_site WHERE company_id=? AND is_dashboard_visible=TRUE ORDER BY site_id";
        when(jdbc.query(eq(sql), any(RowMapper.class), eq(42L))).thenReturn(List.of("001"));
        CurrentUserService service = new CurrentUserService(jdbc);
        CurrentUser admin = new CurrentUser(7, 42, "root@example.com", "Root", "SUPER_ADMIN", "ACTIVE");

        assertEquals(Set.of("001"), service.visibleSiteIds(admin));
        verify(jdbc).query(eq(sql), any(RowMapper.class), eq(42L));
    }

    @Test
    @SuppressWarnings("unchecked")
    void dashboardSitesRespectUserAssignmentAndCompanyVisibility() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        String sql = "SELECT us.site_id FROM user_site us JOIN company_site cs ON cs.site_id=us.site_id " +
            "WHERE us.user_id=? AND cs.company_id=? AND cs.is_dashboard_visible=TRUE ORDER BY us.site_id";
        when(jdbc.query(eq(sql), any(RowMapper.class), eq(9L), eq(42L))).thenReturn(List.of("002"));
        CurrentUserService service = new CurrentUserService(jdbc);
        CurrentUser user = new CurrentUser(9, 42, "user@example.com", "User", "USER", "ACTIVE");

        assertEquals(Set.of("002"), service.visibleSiteIds(user));
    }
}
