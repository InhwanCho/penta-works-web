package com.pentaworks.monitoring.admin;

import com.pentaworks.monitoring.auth.*;
import com.pentaworks.monitoring.auth.CurrentUserService.CurrentUser;
import com.pentaworks.monitoring.dashboard.DashboardService;
import com.pentaworks.monitoring.alert.AlertEventService;
import com.pentaworks.monitoring.common.BadRequestException;
import java.sql.ResultSet;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class AccountDeletionConfirmationTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final AuditService audit = mock(AuditService.class);
    private final SessionRegistry sessions = mock(SessionRegistry.class);
    private final CurrentUser actor = new CurrentUser(1,1,"admin@example.com","Admin","SUPER_ADMIN","ACTIVE");

    @SuppressWarnings("unchecked")
    private AdminAccountService service() throws Exception {
        when(jdbc.query(anyString(),any(ResultSetExtractor.class),eq(2L),eq(1L))).thenAnswer(invocation -> {
            ResultSet rs=mock(ResultSet.class);
            when(rs.next()).thenReturn(true);
            when(rs.getLong("id")).thenReturn(2L);
            when(rs.getLong("company_id")).thenReturn(1L);
            when(rs.getString("email")).thenReturn("target@example.com");
            when(rs.getString("name")).thenReturn("Target");
            when(rs.getString("role")).thenReturn("USER");
            when(rs.getString("status")).thenReturn("ACTIVE");
            return ((ResultSetExtractor<?>)invocation.getArgument(1)).extractData(rs);
        });
        return new AdminAccountService(jdbc,mock(SecureTokens.class),audit,mock(DashboardService.class),mock(AccountMailService.class),sessions,mock(AlertEventService.class));
    }

    @ParameterizedTest @NullSource @ValueSource(strings={"","wrong@example.com","admin@example.com"})
    void missingOrWrongEmailCannotDeleteAccount(String email) throws Exception {
        var service=service();
        assertThrows(BadRequestException.class,()->service.deleteUser(actor,2L,email));
        verify(jdbc,never()).update(anyString(),any(Object[].class));
        verifyNoInteractions(audit,sessions);
    }

    @Test void matchingEmailDeletesOnlyTheSelectedAccountAndRevokesSessions() throws Exception {
        service().deleteUser(actor,2L," TARGET@example.com ");
        verify(jdbc).update("DELETE FROM user_site WHERE user_id=?",2L);
        verify(jdbc).update("DELETE FROM site_alert_recipient WHERE user_id=?",2L);
        verify(sessions).invalidateUser(2L);
        verify(jdbc).update(contains("status='DELETED'"),any(),any(),any(),eq(2L));
    }
}
