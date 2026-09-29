package com.pentaworks.monitoring.admin;

import com.pentaworks.monitoring.admin.AdminAccountController.CreateSiteRequest;
import com.pentaworks.monitoring.admin.AdminAccountController.InviteRequest;
import com.pentaworks.monitoring.auth.CurrentUserService.CurrentUser;
import com.pentaworks.monitoring.auth.SecureTokens;
import com.pentaworks.monitoring.auth.SessionRegistry;
import com.pentaworks.monitoring.common.BadRequestException;
import com.pentaworks.monitoring.common.ForbiddenException;
import com.pentaworks.monitoring.dashboard.DashboardService;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;
import java.sql.ResultSet;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

class AdminAccountServiceTest {
    @Test
    void companyAdministratorCannotHideSitesForTheWholeCompany() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        AdminAccountService service = new AdminAccountService(jdbc, mock(SecureTokens.class),
            mock(AuditService.class), mock(DashboardService.class), mock(AccountMailService.class),
            mock(SessionRegistry.class), mock(com.pentaworks.monitoring.alert.AlertEventService.class));
        CurrentUser admin = new CurrentUser(1, 1, "admin@example.com", "Admin", "ADMIN", "ACTIVE");

        assertThrows(ForbiddenException.class, () -> service.updateSiteVisibility(admin, "001", false));
        verifyNoInteractions(jdbc);
    }

    @Test
    void regularUserCannotCreateSite() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        AuditService audit = mock(AuditService.class);
        DashboardService dashboard = mock(DashboardService.class);
        AdminAccountService service = new AdminAccountService(jdbc, mock(SecureTokens.class), audit, dashboard,
            mock(AccountMailService.class), mock(SessionRegistry.class), mock(com.pentaworks.monitoring.alert.AlertEventService.class));
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
        AdminAccountService service = new AdminAccountService(jdbc, mock(SecureTokens.class), audit, dashboard,
            mock(AccountMailService.class), mock(SessionRegistry.class), mock(com.pentaworks.monitoring.alert.AlertEventService.class));
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
        AdminAccountService service = new AdminAccountService(jdbc, mock(SecureTokens.class), audit, dashboard,
            mock(AccountMailService.class), mock(SessionRegistry.class), mock(com.pentaworks.monitoring.alert.AlertEventService.class));
        CurrentUser admin = new CurrentUser(1, 1, "admin@example.com", "Admin", "ADMIN", "ACTIVE");

        assertThrows(BadRequestException.class, () -> service.createSite(admin,
            new CreateSiteRequest("040", "테스트", null, null, null, "Asia/Seoul")));

        verifyNoInteractions(jdbc, audit, dashboard);
    }

    @Test
    void administratorCannotInviteSuperAdministrator() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        AuditService audit = mock(AuditService.class);
        DashboardService dashboard = mock(DashboardService.class);
        AccountMailService mail = mock(AccountMailService.class);
        SessionRegistry sessions = mock(SessionRegistry.class);
        AdminAccountService service = new AdminAccountService(jdbc, mock(SecureTokens.class), audit, dashboard,
            mail, sessions, mock(com.pentaworks.monitoring.alert.AlertEventService.class));
        CurrentUser admin = new CurrentUser(1, 1, "admin@example.com", "Admin", "ADMIN", "ACTIVE");

        assertThrows(ForbiddenException.class, () -> service.invite(admin,
            new InviteRequest("next@example.com", "Next", "SUPER_ADMIN", List.of())));

        verifyNoInteractions(jdbc, audit, dashboard, mail, sessions);
    }

    @Test
    @SuppressWarnings("unchecked")
    void cannotDeleteCurrentAccount() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        AuditService audit = mock(AuditService.class);
        AdminAccountService service = new AdminAccountService(jdbc, mock(SecureTokens.class), audit,
            mock(DashboardService.class), mock(AccountMailService.class), mock(SessionRegistry.class), mock(com.pentaworks.monitoring.alert.AlertEventService.class));
        CurrentUser superAdmin = new CurrentUser(1, 1, "root@example.com", "Root", "SUPER_ADMIN", "ACTIVE");
        when(jdbc.query(anyString(), any(ResultSetExtractor.class), eq(1L), eq(1L))).thenAnswer(invocation -> {
            ResultSet rs = mock(ResultSet.class);
            when(rs.next()).thenReturn(true);
            when(rs.getLong("id")).thenReturn(1L);
            when(rs.getLong("company_id")).thenReturn(1L);
            when(rs.getString("email")).thenReturn("root@example.com");
            when(rs.getString("name")).thenReturn("Root");
            when(rs.getString("role")).thenReturn("SUPER_ADMIN");
            when(rs.getString("status")).thenReturn("ACTIVE");
            ResultSetExtractor<?> extractor = invocation.getArgument(1);
            return extractor.extractData(rs);
        });

        assertThrows(BadRequestException.class, () -> service.deleteUser(superAdmin, 1L));
        verifyNoInteractions(audit);
    }

    @Test
    @SuppressWarnings("unchecked")
    void cannotDeleteLastSuperAdministrator() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        AuditService audit = mock(AuditService.class);
        AdminAccountService service = new AdminAccountService(jdbc, mock(SecureTokens.class), audit,
            mock(DashboardService.class), mock(AccountMailService.class), mock(SessionRegistry.class), mock(com.pentaworks.monitoring.alert.AlertEventService.class));
        CurrentUser superAdmin = new CurrentUser(1, 1, "root@example.com", "Root", "SUPER_ADMIN", "ACTIVE");
        when(jdbc.query(anyString(), any(ResultSetExtractor.class), eq(2L), eq(1L))).thenAnswer(invocation -> {
            ResultSet rs = mock(ResultSet.class);
            when(rs.next()).thenReturn(true);
            when(rs.getLong("id")).thenReturn(2L);
            when(rs.getLong("company_id")).thenReturn(1L);
            when(rs.getString("email")).thenReturn("other@example.com");
            when(rs.getString("name")).thenReturn("Other");
            when(rs.getString("role")).thenReturn("SUPER_ADMIN");
            when(rs.getString("status")).thenReturn("ACTIVE");
            ResultSetExtractor<?> extractor = invocation.getArgument(1);
            return extractor.extractData(rs);
        });
        when(jdbc.queryForObject(anyString(), eq(Integer.class), eq(1L))).thenReturn(1);
        when(jdbc.queryForObject(anyString(), eq(Long.class), eq(1L))).thenReturn(1L);

        assertThrows(BadRequestException.class, () -> service.deleteUser(superAdmin, 2L));
        verifyNoInteractions(audit);
    }
}
