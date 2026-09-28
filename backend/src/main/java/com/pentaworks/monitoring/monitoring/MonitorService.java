package com.pentaworks.monitoring.monitoring;

import com.pentaworks.monitoring.alert.AlertService;
import com.pentaworks.monitoring.alert.AlertThreshold;
import com.pentaworks.monitoring.alert.SiteAlertSettings;
import com.pentaworks.monitoring.alert.AlertEventService;
import com.pentaworks.monitoring.alert.AlertEventService.Transition;
import com.pentaworks.monitoring.config.AppProperties;
import com.pentaworks.monitoring.dashboard.DashboardResponse;
import com.pentaworks.monitoring.dashboard.DashboardService;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
public class MonitorService {
    private final DashboardService dashboardService;
    private final AlertService alertService;
    private final AlertEventService alertEvents;
    private final AppProperties properties;
    private final RestClient restClient = RestClient.create();

    public MonitorService(DashboardService dashboardService, AlertService alertService,
                          AlertEventService alertEvents, AppProperties properties) {
        this.dashboardService = dashboardService;
        this.alertService = alertService;
        this.alertEvents = alertEvents;
        this.properties = properties;
    }

    public Map<String, Object> run() {
        Map<String, SiteAlertSettings> settings = new LinkedHashMap<>();
        alertService.alertSettings().forEach(value -> settings.put(value.siteid(), value));
        List<Transition> transitions = new ArrayList<>();
        for (DashboardResponse.DashboardRow row : dashboardService.getDashboard().rows()) {
            SiteAlertSettings site = settings.get(row.siteDb());
            if (row.name() == null || site == null) continue;
            for (AlertThreshold threshold : site.thresholds()) {
                Double value = row.metrics().get(threshold.key());
                if (!threshold.active()) continue;
                Transition transition = alertEvents.evaluate(site, threshold, value);
                if (transition != null) transitions.add(transition);
            }
        }
        sendSlack(transitions);
        return Map.of("ok", true, "count", transitions.size(), "alerts", transitions);
    }

    private void sendSlack(List<Transition> alerts) {
        if (alerts.isEmpty()) return;
        List<Long> eventIds = alerts.stream().map(Transition::eventId).toList();
        String webhook = properties.monitor().slackWebhookUrl();
        if (webhook == null || webhook.isBlank()) {
            alertEvents.markDelivery(eventIds, "SKIPPED", null);
            return;
        }
        String text = "[MREyes 이상 감지 " + alerts.size() + "건]";
        try {
            restClient.post().uri(webhook).contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("text", text, "alerts", alerts)).retrieve().toBodilessEntity();
            alertEvents.markDelivery(eventIds, "SENT", null);
        } catch (RuntimeException error) {
            String message = error.getMessage() == null ? "Slack delivery failed" : error.getMessage();
            alertEvents.markDelivery(eventIds, "FAILED", message.substring(0, Math.min(message.length(), 1000)));
            throw error;
        }
    }
}
