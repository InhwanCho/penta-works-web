package com.pentaworks.monitoring.admin;

import com.pentaworks.monitoring.admin.AdminAccountController.CreateSiteRequest;
import com.pentaworks.monitoring.auth.CurrentUserService.CurrentUser;
import com.pentaworks.monitoring.auth.SecureTokens;
import com.pentaworks.monitoring.common.BadRequestException;
import com.pentaworks.monitoring.common.ForbiddenException;
import com.pentaworks.monitoring.dashboard.DashboardService;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

class AdminAccountServiceTest {
    @Test
    void regularUserCannotCreateSite() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        AuditService audit = mock(AuditService.class);
        DashboardService dashboard = mock(DashboardService.class);
        AdminAccountService service = new AdminAccountService(jdbc, mock(SecureTokens.class), audit, dashboard);
        CurrentUser user = new CurrentUser(2, 1, "user@example.com", "User", "USER", "ACTIVE");

        assertThrows(ForbiddenException.class, () -> service.createSite(user,
            new CreateSiteRequest("031", "병원", null, null, null, "Asia/Seoul")));

        verifyNoInteractions(jdbc, audit, dashboard);
    }

    @Test
    void rejectsInvalidSiteTimezoneBeforeDatabaseWrite() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        AuditService audit = mock(AuditService.class);
        DashboardService dashboard = mock(DashboardService.class);
        AdminAccountService service = new AdminAccountService(jdbc, mock(SecureTokens.class), audit, dashboard);
        CurrentUser admin = new CurrentUser(1, 1, "admin@example.com", "Admin", "ADMIN", "ACTIVE");

        assertThrows(BadRequestException.class, () -> service.createSite(admin,
            new CreateSiteRequest("031", "병원", null, null, null, "Not/A-Timezone")));

        verifyNoInteractions(jdbc, audit, dashboard);
    }

    @Test
    void rejectsReservedTestSite() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        AuditService audit = mock(AuditService.class);
        DashboardService dashboard = mock(DashboardService.class);
        AdminAccountService service = new AdminAccountService(jdbc, mock(SecureTokens.class), audit, dashboard);
        CurrentUser admin = new CurrentUser(1, 1, "admin@example.com", "Admin", "ADMIN", "ACTIVE");

        assertThrows(BadRequestException.class, () -> service.createSite(admin,
            new CreateSiteRequest("040", "테스트", null, null, null, "Asia/Seoul")));

        verifyNoInteractions(jdbc, audit, dashboard);
    }
}
