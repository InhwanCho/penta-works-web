package com.pentaworks.monitoring.dashboard;

import com.pentaworks.monitoring.auth.CurrentUserService;
import com.pentaworks.monitoring.auth.CurrentUserService.CurrentUser;
import com.pentaworks.monitoring.common.ForbiddenException;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class DashboardVisibilityServiceTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final CurrentUserService users = mock(CurrentUserService.class);
    private final DashboardVisibilityService service = new DashboardVisibilityService(jdbc, users);
    private final CurrentUser actor = new CurrentUser(7, 1, "qa@example.com", "담당자", "USER", "ACTIVE");

    @Test void readIsScopedToCurrentAccountAndOmitsRevokedAssignments() {
        when(users.allowedSiteIds(actor)).thenReturn(Set.of("001"));
        when(jdbc.queryForList("SELECT site_id FROM user_dashboard_hidden_site WHERE user_id=? ORDER BY site_id", String.class, 7L)).thenReturn(List.of("001", "002"));
        assertEquals(List.of("001"), service.hiddenSites(actor));
        verify(jdbc).queryForList("SELECT site_id FROM user_dashboard_hidden_site WHERE user_id=? ORDER BY site_id", String.class, 7L);
    }

    @Test void unassignedSiteIsRejectedBeforeWritingAnything() {
        doThrow(new ForbiddenException("권한 없음")).when(users).requireSiteAccess(actor, "999");
        assertThrows(ForbiddenException.class, () -> service.setHidden(actor, "999", true));
        verifyNoInteractions(jdbc);
    }

    @Test void hidingAndRestoringOnlyChangesPersonalDisplaySettings() {
        when(users.allowedSiteIds(actor)).thenReturn(Set.of("001"));
        when(jdbc.queryForList(anyString(), eq(String.class), eq(7L))).thenReturn(List.of("001"), List.of());
        assertEquals(List.of("001"), service.setHidden(actor, "001", true));
        assertEquals(List.of(), service.setHidden(actor, "001", false));
        verify(users, times(2)).requireSiteAccess(actor, "001");
        verify(jdbc).update("INSERT IGNORE INTO user_dashboard_hidden_site(user_id,site_id) VALUES(?,?)", 7L, "001");
        verify(jdbc).update("DELETE FROM user_dashboard_hidden_site WHERE user_id=? AND site_id=?", 7L, "001");
        verify(jdbc, times(2)).queryForList(anyString(), eq(String.class), eq(7L));
        verifyNoMoreInteractions(jdbc);
    }

    @Test void restoringAllCannotChangeAnotherAccount() {
        assertEquals(List.of(), service.restoreAll(actor));
        verify(jdbc).update("DELETE FROM user_dashboard_hidden_site WHERE user_id=?", 7L);
        verifyNoMoreInteractions(jdbc);
    }
}
