package com.pentaworks.monitoring.company;

import com.pentaworks.monitoring.admin.AuditService;
import com.pentaworks.monitoring.auth.CurrentUserService.CurrentUser;
import com.pentaworks.monitoring.common.BadRequestException;
import com.pentaworks.monitoring.common.ForbiddenException;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class CompanyMetricServiceTest {
    @AfterEach
    void clearSynchronization() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    void ordinaryAdminCannotSaveCompanyDisplaySettings() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        AuditService audit = mock(AuditService.class);
        CompanyMetricService service = new CompanyMetricService(jdbc, audit);

        assertThrows(ForbiddenException.class, () -> service.save(user(2, "ADMIN"), defaults()));
        verifyNoInteractions(jdbc, audit);
    }

    @Test
    void atLeastOneMetricMustRemainVisible() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(Long.class), anyLong())).thenReturn(1L);
        CompanyMetricService service = new CompanyMetricService(jdbc, mock(AuditService.class));
        List<CompanyMetricService.Metric> hidden = defaults().stream()
            .map(metric -> new CompanyMetricService.Metric(metric.key(), metric.displayName(), metric.unit(), metric.sortOrder(), false))
            .toList();

        assertThrows(BadRequestException.class, () -> service.save(user(2, "SUPER_ADMIN"), hidden));
    }

    @Test
    void companyCachesAreIsolatedAndSaveNormalizesOrder() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        AuditService audit = mock(AuditService.class);
        ResultSet row = mock(ResultSet.class);
        when(row.getString(1)).thenReturn("hepres");
        when(row.getString(2)).thenReturn("회사 1 압력");
        when(row.getString(3)).thenReturn("bar");
        when(row.getInt(4)).thenReturn(0);
        when(row.getBoolean(5)).thenReturn(true);
        doAnswer(invocation -> {
            Object argument = invocation.getArgument(2);
            long companyId = argument instanceof Object[] values
                ? ((Number) values[0]).longValue() : ((Number) argument).longValue();
            if (companyId == 1L) ((RowCallbackHandler) invocation.getArgument(1)).processRow(row);
            return null;
        }).when(jdbc).query(anyString(), any(RowCallbackHandler.class), any(Object[].class));
        when(jdbc.queryForObject(anyString(), eq(Long.class), anyLong())).thenReturn(2L);
        when(jdbc.update(anyString(), any(Object[].class))).thenReturn(1);
        CompanyMetricService service = new CompanyMetricService(jdbc, audit);

        assertEquals("회사 1 압력", service.metrics(1L).get(0).displayName());
        assertEquals("He Pressure", service.metrics(2L).get(0).displayName());

        TransactionSynchronizationManager.initSynchronization();
        List<CompanyMetricService.Metric> reversed = new ArrayList<>(defaults());
        Collections.reverse(reversed);
        List<CompanyMetricService.Metric> saved = service.save(user(2, "SUPER_ADMIN"), reversed);

        assertEquals("gcflow", saved.get(0).key());
        assertEquals(0, saved.get(0).sortOrder());
        assertEquals(10, saved.get(10).sortOrder());
        verify(jdbc, times(14)).update(org.mockito.ArgumentMatchers.contains("INSERT INTO company_metric_config"), any(Object[].class));
        verify(audit).record(any(), eq("COMPANY_METRICS_UPDATED"), eq("COMPANY"), eq("2"), any());
        assertTrue(TransactionSynchronizationManager.getSynchronizations().size() == 1);
    }

    private static CurrentUser user(long companyId, String role) {
        return new CurrentUser(7L, companyId, "user@example.com", "사용자", role, "ACTIVE");
    }

    private static List<CompanyMetricService.Metric> defaults() {
        return List.of(
            metric("hepres", "He Pressure", "psi"), metric("heleve", "He Level", "%"),
            metric("gctemp", "그라디언트칠러 온도", "°C"), metric("cctemp", "콜드칠러 IN 온도", "°C"),
            metric("ccflow", "콜드칠러 OUT 온도", "°C"), metric("actemp", "항온항습기 온도", "°C"),
            metric("achumi", "항온항습기 습도", "%"), metric("lastAt", "최신 시각", null),
            metric("count1h", "1시간 건수", null), metric("count24h", "24시간 건수", null),
            metric("recosi", "리콘덴서 Si410 온도", "K"), metric("recoru", "리콘덴서 RuO 온도", "K"),
            metric("coldtp", "콜드헤드 온도", "K"), metric("gcflow", "그라디언트칠러 유량", null));
    }

    private static CompanyMetricService.Metric metric(String key, String name, String unit) {
        return new CompanyMetricService.Metric(key, name, unit, 0, true);
    }
}
