package com.pentaworks.monitoring.alert;

import com.pentaworks.monitoring.admin.AuditService;
import com.pentaworks.monitoring.alert.AlertRecipientService.CreateRecipient;
import com.pentaworks.monitoring.auth.CurrentUserService;
import com.pentaworks.monitoring.auth.CurrentUserService.CurrentUser;
import com.pentaworks.monitoring.common.BadRequestException;
import java.sql.ResultSet;
import java.sql.Time;
import java.time.LocalTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class AlertRecipientServiceTest {
    @Test
    void rejectsNonSlackWebhookBeforeDatabaseWrite() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        CurrentUserService currentUsers = mock(CurrentUserService.class);
        AuditService audit = mock(AuditService.class);
        AlertRecipientService service = new AlertRecipientService(jdbc, currentUsers, audit);
        CurrentUser admin = new CurrentUser(1, 1, "admin@example.com", "Admin", "ADMIN", "ACTIVE");

        assertThrows(BadRequestException.class, () -> service.create(admin,
            new CreateRecipient("001", "http://example.com/hook", null, null, true)));

        verify(currentUsers).requireSiteAccess(admin, "001");
        verifyNoInteractions(jdbc, audit);
    }

    @Test
    @SuppressWarnings("unchecked")
    void excludesWebhookDuringOvernightQuietHours() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        AlertRecipientService service = new AlertRecipientService(jdbc,
            mock(CurrentUserService.class), mock(AuditService.class));
        when(jdbc.query(anyString(), any(RowMapper.class), eq("001"), eq("SLACK_WEBHOOK")))
            .thenAnswer(invocation -> {
                ResultSet resultSet = mock(ResultSet.class);
                when(resultSet.getString("destination")).thenReturn("https://hooks.slack.com/services/test");
                when(resultSet.getTime("quiet_start")).thenReturn(Time.valueOf("22:00:00"));
                when(resultSet.getTime("quiet_end")).thenReturn(Time.valueOf("08:00:00"));
                RowMapper<?> mapper = invocation.getArgument(1);
                return List.of(mapper.mapRow(resultSet, 0));
            });

        assertEquals(List.of(), service.activeWebhooks("001", LocalTime.of(23, 0)));
        assertEquals(List.of("https://hooks.slack.com/services/test"),
            service.activeWebhooks("001", LocalTime.of(12, 0)));
    }
}
