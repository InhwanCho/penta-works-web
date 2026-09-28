package com.pentaworks.monitoring.monitoring;

import com.pentaworks.monitoring.alert.AlertService;
import com.pentaworks.monitoring.alert.AlertThreshold;
import com.pentaworks.monitoring.alert.SiteAlertSettings;
import com.pentaworks.monitoring.config.AppProperties;
import com.pentaworks.monitoring.dashboard.DashboardResponse;
import com.pentaworks.monitoring.dashboard.DashboardService;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class MonitorServiceTest {
    @Test
    @SuppressWarnings("unchecked")
    void evaluatesEveryEnabledMetric() {
        DashboardService dashboard = mock(DashboardService.class);
        AlertService alerts = mock(AlertService.class);
        AppProperties properties = new AppProperties(null, null, new AppProperties.Monitor("secret", ""), null);
        DashboardResponse.DashboardRow row = new DashboardResponse.DashboardRow(
            "001", "1", "병원", "2026-09-28T00:00:00Z", 0L, 1, 1, 1.0, 70.0,
            Map.of("actemp", 31.0, "hepres", 1.0));
        when(dashboard.getDashboard()).thenReturn(new DashboardResponse(
            new DashboardResponse.Meta(1, 1, 1), new DashboardResponse.Stats(1, 1, 0, 1),
            List.of(row), Map.of(), null));
        when(alerts.alertSettings()).thenReturn(List.of(new SiteAlertSettings("001", "병원", true, List.of(
            new AlertThreshold("actemp", "AC Temp", "°C", 15.0, 25.0, true),
            new AlertThreshold("hepres", "He Pressure", "psi", 0.8, 1.3, true)
        ))));

        Map<String, Object> result = new MonitorService(dashboard, alerts, properties).run();

        assertEquals(1, result.get("count"));
        List<Map<String, Object>> rows = (List<Map<String, Object>>) result.get("alerts");
        assertEquals("actemp", rows.get(0).get("metric"));
        assertEquals("high", rows.get(0).get("direction"));
    }
}
