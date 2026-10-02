package com.pentaworks.monitoring.monitoring;

import com.pentaworks.monitoring.alert.AlertService;
import com.pentaworks.monitoring.alert.AlertEventService;
import com.pentaworks.monitoring.alert.AlertRecipientService;
import com.pentaworks.monitoring.alert.AlertThreshold;
import com.pentaworks.monitoring.alert.SiteAlertSettings;
import com.pentaworks.monitoring.dashboard.DashboardResponse;
import com.pentaworks.monitoring.dashboard.DashboardService;
import java.util.List;
import java.util.Map;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

class MonitorServiceTest {
    @Test
    void deliversThresholdAlertToRegisteredKakaoPhone() {
        DashboardService dashboard = mock(DashboardService.class);
        AlertService alerts = mock(AlertService.class);
        AlertEventService alertEvents = mock(AlertEventService.class);
        AlertRecipientService recipients = mock(AlertRecipientService.class);
        var deliveries = mock(com.pentaworks.monitoring.alert.AlertDeliveryService.class);
        var kakao = mock(com.pentaworks.monitoring.alert.BaroKakaoService.class);
        var row = new DashboardResponse.DashboardRow("001", "1", "병원", "2026-09-30T00:00:00Z",
            0L, 1, 1, 1.0, 70.0, Map.of("hepres", 3.25), "NORMAL", 0, 0, List.of());
        when(dashboard.getDashboard()).thenReturn(new DashboardResponse(
            new DashboardResponse.Meta(1, 1, 1), new DashboardResponse.Stats(1, 1, 0, 1, 1, 0, 0, 0),
            List.of(row), Map.of(), null));
        var threshold = new AlertThreshold("hepres", "He Pressure", "psi", 0.5, 2.0, true);
        when(alerts.alertSettings()).thenReturn(List.of(new SiteAlertSettings("001", "병원", true,
            List.of(threshold), 30, false, true, 0, 0, null, null, false)));
        var transition = new AlertEventService.Transition(10, "001", "병원", "hepres", "He Pressure",
            "psi", "HIGH", 3.25, 0.5, 2.0, "이상");
        when(alertEvents.evaluate(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.eq(3.25))).thenReturn(transition);
        when(recipients.activePhones(org.mockito.ArgumentMatchers.eq("001"), org.mockito.ArgumentMatchers.any()))
            .thenReturn(List.of("01012345678"));
        when(recipients.activePhones(org.mockito.ArgumentMatchers.eq("001"), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.eq(10L)))
            .thenReturn(List.of("01012345678"));
        var batch = new com.pentaworks.monitoring.alert.AlertDeliveryService.Batch(10, "batch");
        when(deliveries.begin(10, List.of("KAKAO_ALIMTALK:01012345678"), false)).thenReturn(batch);
        when(deliveries.claim(batch, "KAKAO_ALIMTALK:01012345678")).thenReturn(true);
        when(kakao.send("01012345678", transition)).thenReturn("receipt-1");

        new MonitorService(dashboard, alerts, alertEvents, recipients, deliveries, kakao).run();

        verify(kakao).send("01012345678", transition);
        verify(deliveries).accepted(batch, "KAKAO_ALIMTALK:01012345678", "receipt-1");
        verify(deliveries).finish(batch);
    }

    @Test
    void manualRetryDoesNotReportSuccessWhenAnotherWorkerOwnsTheBatch() {
        DashboardService dashboard = mock(DashboardService.class);
        AlertService alerts = mock(AlertService.class);
        AlertEventService alertEvents = mock(AlertEventService.class);
        AlertRecipientService recipients = mock(AlertRecipientService.class);
        com.pentaworks.monitoring.alert.AlertDeliveryService deliveries =
            mock(com.pentaworks.monitoring.alert.AlertDeliveryService.class);
        AlertEventService.Transition transition = new AlertEventService.Transition(
            10, "001", "병원", "actemp", "AC Temp", "°C", "HIGH", 31.0, 15.0, 25.0, "이상");
        SiteAlertSettings policy = new SiteAlertSettings("001", "병원", true, List.of(), 30, true,
            true, 0, 0, null, null, false, List.of(), false);
        when(alertEvents.retryTransition(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.eq(10L)))
            .thenReturn(transition);
        when(alerts.alertSettings()).thenReturn(List.of(policy));
        when(recipients.activePhones(org.mockito.ArgumentMatchers.eq("001"), org.mockito.ArgumentMatchers.any()))
            .thenReturn(List.of("01012345678"));
        when(deliveries.begin(10L, List.of("KAKAO_ALIMTALK:01012345678"), true)).thenReturn(null);
        when(recipients.activePhones(org.mockito.ArgumentMatchers.eq("001"), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.eq(10L)))
            .thenReturn(List.of("01012345678"));
        var actor = new com.pentaworks.monitoring.auth.CurrentUserService.CurrentUser(
            1L, 1L, "admin@example.com", "관리자", "ADMIN", "ACTIVE");

        assertThrows(com.pentaworks.monitoring.common.BadRequestException.class,
            () -> new MonitorService(dashboard, alerts, alertEvents, recipients, deliveries,
                mock(com.pentaworks.monitoring.alert.BaroKakaoService.class)).retry(actor, 10L));
        verify(deliveries).begin(10L, List.of("KAKAO_ALIMTALK:01012345678"), true);
    }

    @Test
    @SuppressWarnings("unchecked")
    void evaluatesEveryEnabledMetric() {
        DashboardService dashboard = mock(DashboardService.class);
        AlertService alerts = mock(AlertService.class);
        AlertEventService alertEvents = mock(AlertEventService.class);
        AlertRecipientService recipients = mock(AlertRecipientService.class);
        DashboardResponse.DashboardRow row = new DashboardResponse.DashboardRow(
            "001", "1", "병원", "2026-09-28T00:00:00Z", 0L, 1, 1, 1.0, 70.0,
            Map.of("actemp", 31.0, "hepres", 1.0), "NORMAL", 0, 0, List.of());
        when(dashboard.getDashboard()).thenReturn(new DashboardResponse(
            new DashboardResponse.Meta(1, 1, 1), new DashboardResponse.Stats(1, 1, 0, 1, 1, 0, 0, 0),
            List.of(row), Map.of(), null));
        when(alerts.alertSettings()).thenReturn(List.of(new SiteAlertSettings("001", "병원", true, List.of(
            new AlertThreshold("actemp", "AC Temp", "°C", 15.0, 25.0, true),
            new AlertThreshold("hepres", "He Pressure", "psi", 0.8, 1.3, true)
        ), 30, false, true, 0, 0, null, null, false)));
        when(recipients.hasConfiguredPhones("001")).thenReturn(true);
        AlertEventService.Transition transition = new AlertEventService.Transition(
            10, "001", "병원", "actemp", "AC Temp", "°C", "HIGH", 31.0, 15.0, 25.0,
            "병원 · AC Temp 값이 최대값보다 높습니다.");
        when(alertEvents.evaluate(org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.argThat(threshold -> "actemp".equals(threshold.key())),
            org.mockito.ArgumentMatchers.eq(31.0))).thenReturn(transition);

        Map<String, Object> result = new MonitorService(dashboard, alerts, alertEvents, recipients,
            mock(com.pentaworks.monitoring.alert.AlertDeliveryService.class),
            mock(com.pentaworks.monitoring.alert.BaroKakaoService.class)).run();

        assertEquals(1, result.get("count"));
        List<AlertEventService.Transition> rows = (List<AlertEventService.Transition>) result.get("alerts");
        assertEquals("actemp", rows.get(0).metricKey());
        assertEquals("HIGH", rows.get(0).eventType());
        verify(alertEvents).markDelivery(List.of(10L), "SKIPPED",
            "사용 가능한 수신 채널이 없습니다. 채널 사용 여부와 제외 시간을 확인해주세요.", 0);
    }

    @Test
    void hiddenSiteNeverCreatesOrSendsAlerts() {
        DashboardService dashboard = mock(DashboardService.class);
        AlertService alerts = mock(AlertService.class);
        AlertEventService alertEvents = mock(AlertEventService.class);
        AlertRecipientService recipients = mock(AlertRecipientService.class);
        DashboardResponse.DashboardRow row = new DashboardResponse.DashboardRow(
            "001", "1", "병원", "2026-09-28T00:00:00Z", 0L, 1, 1, 1.0, 70.0,
            Map.of("hepres", 1.0), "NORMAL", 0, 0, List.of());
        when(dashboard.getDashboard()).thenReturn(new DashboardResponse(
            new DashboardResponse.Meta(1, 1, 1), new DashboardResponse.Stats(1, 1, 0, 1, 1, 0, 0, 0),
            List.of(row), Map.of(), null));
        when(alerts.alertSettings()).thenReturn(List.of(new SiteAlertSettings("001", "병원", true,
            List.of(new AlertThreshold("hepres", "He Pressure", "psi", 0.8, 1.3, true)),
            30, true, true, 0, 0, null, null, false, List.of(), false)));

        assertEquals(0, new MonitorService(dashboard, alerts, alertEvents, recipients,
            mock(com.pentaworks.monitoring.alert.AlertDeliveryService.class),
            mock(com.pentaworks.monitoring.alert.BaroKakaoService.class)).run().get("count"));
        verifyNoInteractions(alertEvents, recipients);
    }

    @Test
    void appliesOvernightWeekendAndCustomHolidayWindows() {
        SiteAlertSettings overnight = new SiteAlertSettings("001", "병원", true, List.of(), 30, true,
            true, 0, 0, LocalTime.of(22, 0), LocalTime.of(8, 0), false, List.of());
        ZoneId seoul = ZoneId.of("Asia/Seoul");
        assertFalse(MonitorService.deliveryAllowed(overnight,
            ZonedDateTime.of(2026, 9, 29, 23, 0, 0, 0, seoul)));
        assertTrue(MonitorService.deliveryAllowed(overnight,
            ZonedDateTime.of(2026, 9, 29, 12, 0, 0, 0, seoul)));

        SiteAlertSettings holidays = new SiteAlertSettings("001", "병원", true, List.of(), 30, true,
            true, 0, 0, null, null, true, List.of(LocalDate.of(2026, 9, 30)));
        assertFalse(MonitorService.deliveryAllowed(holidays,
            ZonedDateTime.of(2026, 10, 3, 12, 0, 0, 0, seoul)));
        assertFalse(MonitorService.deliveryAllowed(holidays,
            ZonedDateTime.of(2026, 9, 30, 12, 0, 0, 0, seoul)));
        assertTrue(MonitorService.deliveryAllowed(holidays,
            ZonedDateTime.of(2026, 10, 1, 12, 0, 0, 0, seoul)));
    }
}
