package com.pentaworks.monitoring.alert;

import com.pentaworks.monitoring.admin.AuditService;
import com.pentaworks.monitoring.auth.CurrentUserService;
import com.pentaworks.monitoring.auth.CurrentUserService.CurrentUser;
import com.pentaworks.monitoring.common.BadRequestException;
import com.pentaworks.monitoring.common.ForbiddenException;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class AlertServiceTest {
    @Test
    void validatesPsiRange() {
        assertDoesNotThrow(() -> AlertService.validateThreshold(0.8, 1.3));
        assertThrows(BadRequestException.class, () -> AlertService.validateThreshold(null, 1.3));
        assertThrows(BadRequestException.class, () -> AlertService.validateThreshold(Double.NaN, 1.3));
        assertThrows(BadRequestException.class, () -> AlertService.validateThreshold(-0.1, 1.3));
        assertThrows(BadRequestException.class, () -> AlertService.validateThreshold(1.4, 1.3));
    }

    @Test
    void rejectsUpdateFromRegularUserBeforeDatabaseWrite() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        CurrentUserService currentUsers = mock(CurrentUserService.class);
        AuditService audit = mock(AuditService.class);
        AlertService service = new AlertService(jdbcTemplate, currentUsers, audit);
        CurrentUser user = new CurrentUser(2, 1, "user@example.com", "User", "USER", "ACTIVE");

        assertThrows(ForbiddenException.class,
            () -> service.updatePsiThreshold(user, "001", 0.8, 1.3, true));
        verifyNoInteractions(jdbcTemplate, currentUsers, audit);
    }

    @Test
    @SuppressWarnings("unchecked")
    void updatesAccessibleSiteAndWritesAuditLog() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        CurrentUserService currentUsers = mock(CurrentUserService.class);
        AuditService audit = mock(AuditService.class);
        AlertService service = new AlertService(jdbcTemplate, currentUsers, audit);
        CurrentUser admin = new CurrentUser(1, 1, "admin@example.com", "Admin", "ADMIN", "ACTIVE");
        PsiThreshold saved = new PsiThreshold("001", "병원", 0.8, 1.3, true);
        when(jdbcTemplate.queryForObject(any(String.class), any(RowMapper.class), eq("001"))).thenReturn(saved);

        assertEquals(saved, service.updatePsiThreshold(admin, "001", 0.8, 1.3, true));

        verify(currentUsers).requireSiteAccess(admin, "001");
        verify(jdbcTemplate).update(any(String.class), eq("001"), eq(0.8), eq(1.3), eq(true));
        verify(audit).record(eq(admin), eq("PSI_THRESHOLD_UPDATED"), eq("SITE"), eq("001"), any());
    }
}
