package com.pentaworks.monitoring.monitoring;

import com.pentaworks.monitoring.alert.AlertService;
import com.pentaworks.monitoring.alert.AlertEventService;
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
import static org.mockito.Mockito.verify;

class MonitorServiceTest {
    @Test
    @SuppressWarnings("unchecked")
    void evaluatesEveryEnabledMetric() {
        DashboardService dashboard = mock(DashboardService.class);
        AlertService alerts = mock(AlertService.class);
        AlertEventService alertEvents = mock(AlertEventService.class);
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
        AlertEventService.Transition transition = new AlertEventService.Transition(
            10, "001", "병원", "actemp", "AC Temp", "°C", "HIGH", 31.0, 15.0, 25.0,
            "병원 · AC Temp 값이 최대값보다 높습니다.");
        when(alertEvents.evaluate(org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.argThat(threshold -> "actemp".equals(threshold.key())),
            org.mockito.ArgumentMatchers.eq(31.0))).thenReturn(transition);

        Map<String, Object> result = new MonitorService(dashboard, alerts, alertEvents, properties).run();

        assertEquals(1, result.get("count"));
        List<AlertEventService.Transition> rows = (List<AlertEventService.Transition>) result.get("alerts");
        assertEquals("actemp", rows.get(0).metricKey());
        assertEquals("HIGH", rows.get(0).eventType());
        verify(alertEvents).markDelivery(List.of(10L), "SKIPPED", null);
    }
}
