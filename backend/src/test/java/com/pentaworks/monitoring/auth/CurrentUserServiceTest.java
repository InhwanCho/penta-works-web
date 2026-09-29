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
}
