package com.pentaworks.monitoring.platform;

import com.pentaworks.monitoring.admin.AccountMailService;
import com.pentaworks.monitoring.admin.AuditService;
import com.pentaworks.monitoring.auth.CurrentUserService.CurrentUser;
import com.pentaworks.monitoring.auth.SecureTokens;
import com.pentaworks.monitoring.auth.SessionRegistry;
import com.pentaworks.monitoring.common.ForbiddenException;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
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
}
