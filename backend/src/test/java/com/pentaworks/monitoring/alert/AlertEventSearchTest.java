package com.pentaworks.monitoring.alert;

import com.pentaworks.monitoring.admin.AuditService;
import com.pentaworks.monitoring.auth.CurrentUserService;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class AlertEventSearchTest {
    @Test
    @SuppressWarnings("unchecked")
    void pendingCountAndPageExcludeRecoveredIncidentsWithinTheSameUserScope() {
        var jdbc = mock(JdbcTemplate.class);
        new AlertEventService(jdbc, mock(CurrentUserService.class), mock(AuditService.class))
            .search(Set.of("001"),7,1,20,"",null,"unacknowledged","all",null,null);
        verify(jdbc).queryForObject(contains("ack.acknowledged_at IS NULL AND e.recovered_at IS NULL"),eq(Long.class),eq(7L),eq("001"),eq(7L));
        verify(jdbc).query(contains("ack.acknowledged_at IS NULL AND e.recovered_at IS NULL"),any(RowMapper.class),eq(7L),eq("001"),eq(7L),eq(20),eq(0));
    }
    @Test
    @SuppressWarnings("unchecked")
    void fullHistoryKeepsRecoveredIncidentsAndItsUserScope() {
        var jdbc = mock(JdbcTemplate.class);
        new AlertEventService(jdbc, mock(CurrentUserService.class), mock(AuditService.class))
            .search(Set.of("001"),7,1,20,"",null,"all","all",null,null);
        verify(jdbc).queryForObject(argThat(sql->sql.contains("r.user_id=?") && !sql.contains("e.recovered_at IS NULL")),eq(Long.class),eq(7L),eq("001"),eq(7L));
        verify(jdbc).query(argThat(sql->sql.contains("r.user_id=?") && !sql.contains("e.recovered_at IS NULL")),any(RowMapper.class),eq(7L),eq("001"),eq(7L),eq(20),eq(0));
    }
}
