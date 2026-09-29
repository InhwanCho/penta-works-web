package com.pentaworks.monitoring.alert;

import com.pentaworks.monitoring.admin.AuditService;
import com.pentaworks.monitoring.auth.CurrentUserService;
import com.pentaworks.monitoring.auth.CurrentUserService.CurrentUser;
import com.pentaworks.monitoring.common.BadRequestException;
import com.pentaworks.monitoring.common.ForbiddenException;
import com.pentaworks.monitoring.dashboard.DashboardService;
import java.util.List;
import java.util.Set;
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
    void companyDefaultsStartDisabledWithoutChangingExistingSiteSettings() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        AlertService service = new AlertService(jdbcTemplate, mock(CurrentUserService.class),
            mock(AuditService.class), mock(DashboardService.class), mock(AlertEventService.class));
        CurrentUser admin = new CurrentUser(1, 42, "admin@example.com", "Admin", "SUPER_ADMIN", "ACTIVE");

        List<AlertThreshold> defaults = service.companyThresholds(admin);

        assertEquals(11, defaults.size());
        assertEquals(new AlertThreshold("hepres", "He Pressure", "psi", 1.0, 999.0, false),
            defaults.stream().filter(row -> "hepres".equals(row.key())).findFirst().orElseThrow());
    }

    @Test
    void hiddenSiteCannotEnableAlerts() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        CurrentUserService currentUsers = mock(CurrentUserService.class);
        AlertService service = new AlertService(jdbcTemplate, currentUsers,
            mock(AuditService.class), mock(DashboardService.class), mock(AlertEventService.class));
        CurrentUser admin = new CurrentUser(1, 42, "admin@example.com", "Admin", "ADMIN", "ACTIVE");
        when(currentUsers.visibleSiteIds(admin)).thenReturn(Set.of());

        assertThrows(BadRequestException.class, () -> service.setAlertsEnabled(admin, "001", true));
        verifyNoInteractions(jdbcTemplate);
    }

    @Test
    void rejectsUpdateFromRegularUserBeforeDatabaseWrite() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        CurrentUserService currentUsers = mock(CurrentUserService.class);
        AuditService audit = mock(AuditService.class);
        DashboardService dashboard = mock(DashboardService.class);
        AlertEventService alertEvents = mock(AlertEventService.class);
        AlertService service = new AlertService(jdbcTemplate, currentUsers, audit, dashboard, alertEvents);
        CurrentUser user = new CurrentUser(2, 1, "user@example.com", "User", "USER", "ACTIVE");

        assertThrows(ForbiddenException.class,
            () -> service.updatePsiThreshold(user, "001", 0.8, 1.3, true));
        verifyNoInteractions(jdbcTemplate, currentUsers, audit, dashboard, alertEvents);
    }

    @Test
    @SuppressWarnings("unchecked")
    void updatesAccessibleSiteAndWritesAuditLog() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        CurrentUserService currentUsers = mock(CurrentUserService.class);
        AuditService audit = mock(AuditService.class);
        DashboardService dashboard = mock(DashboardService.class);
        AlertEventService alertEvents = mock(AlertEventService.class);
        AlertService service = new AlertService(jdbcTemplate, currentUsers, audit, dashboard, alertEvents);
        CurrentUser admin = new CurrentUser(1, 1, "admin@example.com", "Admin", "ADMIN", "ACTIVE");
        SiteAlertSettings savedSettings = new SiteAlertSettings("001", "병원", true,
            List.of(new AlertThreshold("hepres", "He Pressure", "psi", 0.8, 1.3, true)), 30, false,
            true, 0, 0, null, null, false);
        when(jdbcTemplate.queryForObject(any(String.class), any(RowMapper.class), eq("001"))).thenReturn(savedSettings);
        when(currentUsers.visibleSiteIds(admin)).thenReturn(Set.of("001"));

        assertEquals(new PsiThreshold("001", "병원", 0.8, 1.3, true),
            service.updatePsiThreshold(admin, "001", 0.8, 1.3, true));

        verify(currentUsers).requireSiteAccess(admin, "001");
        verify(jdbcTemplate).update(any(String.class), eq(0.8), eq(1.3), eq(true), eq("001"));
        verify(audit).record(eq(admin), eq("ALERT_THRESHOLDS_UPDATED"), eq("SITE"), eq("001"), any());
        verify(dashboard).invalidateCache();
    }
}
