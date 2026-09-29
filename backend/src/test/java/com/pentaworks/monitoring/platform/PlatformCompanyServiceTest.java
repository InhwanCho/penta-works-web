package com.pentaworks.monitoring.platform;

import com.pentaworks.monitoring.admin.AccountMailService;
import com.pentaworks.monitoring.admin.AuditService;
import com.pentaworks.monitoring.auth.CurrentUserService.CurrentUser;
import com.pentaworks.monitoring.auth.SecureTokens;
import com.pentaworks.monitoring.auth.SessionRegistry;
import com.pentaworks.monitoring.common.ForbiddenException;
import com.pentaworks.monitoring.common.BadRequestException;
import com.pentaworks.monitoring.platform.PlatformCompanyController.AssignSiteRequest;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verifyNoInteractions;

class PlatformCompanyServiceTest {
    @Test
    void companySuperAdministratorCannotAccessPlatformCompanies() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        SecureTokens tokens = mock(SecureTokens.class);
        AccountMailService mail = mock(AccountMailService.class);
        AuditService audit = mock(AuditService.class);
        CompanyDocumentStorage documents = mock(CompanyDocumentStorage.class);
        SessionRegistry sessions = mock(SessionRegistry.class);
        PlatformCompanyService service = new PlatformCompanyService(jdbc, tokens, mail, audit, documents, sessions);
        CurrentUser companyAdmin = new CurrentUser(2, 10, "admin@example.com", "Admin", "SUPER_ADMIN", "ACTIVE");

        assertThrows(ForbiddenException.class, () -> service.companies(companyAdmin));
        verifyNoInteractions(jdbc, tokens, mail, audit, documents, sessions);
    }

    @Test
    void platformRoleOutsidePentaWorksCannotAccessPlatformCompanies() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        PlatformCompanyService service = new PlatformCompanyService(jdbc, mock(SecureTokens.class),
            mock(AccountMailService.class), mock(AuditService.class), mock(CompanyDocumentStorage.class),
            mock(SessionRegistry.class));
        CurrentUser foreignPlatformAdmin = new CurrentUser(3, 20, "admin@customer.example", "Admin",
            "PLATFORM_ADMIN", "ACTIVE");
        when(jdbc.queryForObject(
            "SELECT COUNT(*) FROM company WHERE id=? AND code='PENTAWORKS' AND status='ACTIVE'",
            Integer.class, 20L)).thenReturn(0);

        assertThrows(ForbiddenException.class, () -> service.companies(foreignPlatformAdmin));
    }

    @Test
    @SuppressWarnings("unchecked")
    void movingOwnedSiteRequiresExplicitHistoryTransferConfirmation() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        PlatformCompanyService service = new PlatformCompanyService(jdbc, mock(SecureTokens.class),
            mock(AccountMailService.class), mock(AuditService.class), mock(CompanyDocumentStorage.class),
            mock(SessionRegistry.class));
        CurrentUser platformAdmin = new CurrentUser(1, 1, "admin@pentaworks.net", "Admin",
            "PLATFORM_ADMIN", "ACTIVE");
        when(jdbc.queryForObject(anyString(), eq(Integer.class), eq(1L))).thenReturn(1);
        when(jdbc.queryForObject(anyString(), eq(Integer.class), eq(2L))).thenReturn(1);
        when(jdbc.query(eq("SELECT site FROM site WHERE site=? FOR UPDATE"),
            any(ResultSetExtractor.class), eq("001"))).thenReturn("001");
        when(jdbc.query(eq("SELECT company_id FROM company_site WHERE site_id=? FOR UPDATE"),
            any(ResultSetExtractor.class), eq("001"))).thenReturn(1L);

        assertThrows(BadRequestException.class, () -> service.assignSite(platformAdmin, "001",
            new AssignSiteRequest(2, false)));
        verify(jdbc, never()).update(anyString(), any(Object[].class));
    }
}
