package com.pentaworks.monitoring.monitoring;

import com.pentaworks.monitoring.alert.AlertService;
import com.pentaworks.monitoring.alert.AlertThreshold;
import com.pentaworks.monitoring.alert.SiteAlertSettings;
import com.pentaworks.monitoring.alert.AlertEventService;
import com.pentaworks.monitoring.alert.AlertEventService.Transition;
import com.pentaworks.monitoring.alert.AlertRecipientService;
import com.pentaworks.monitoring.config.AppProperties;
import com.pentaworks.monitoring.dashboard.DashboardResponse;
import com.pentaworks.monitoring.dashboard.DashboardService;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.stream.Collectors;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
public class MonitorService {
    private final DashboardService dashboardService;
    private final AlertService alertService;
    private final AlertEventService alertEvents;
    private final AlertRecipientService recipients;
    private final AppProperties properties;
    private final RestClient restClient = RestClient.create();

    public MonitorService(DashboardService dashboardService, AlertService alertService,
                          AlertEventService alertEvents, AlertRecipientService recipients,
                          AppProperties properties) {
        this.dashboardService = dashboardService;
        this.alertService = alertService;
        this.alertEvents = alertEvents;
        this.recipients = recipients;
        this.properties = properties;
    }

    public Map<String, Object> run() {
        Map<String, SiteAlertSettings> settings = new LinkedHashMap<>();
        alertService.alertSettings().forEach(value -> settings.put(value.siteid(), value));
        List<Transition> transitions = new ArrayList<>();
        for (DashboardResponse.DashboardRow row : dashboardService.getDashboard().rows()) {
            SiteAlertSettings site = settings.get(row.siteDb());
            if (row.name() == null || site == null) continue;
            Transition noData = alertEvents.evaluateNoData(site, row.lagMin());
            if (noData != null) transitions.add(noData);
            if (site.noDataActive() && (row.lagMin() == null || row.lagMin() > site.noDataMinutes())) continue;
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
        Map<String, List<Transition>> bySite = alerts.stream()
            .collect(Collectors.groupingBy(Transition::siteId, LinkedHashMap::new, Collectors.toList()));
        LocalTime now = LocalTime.now(ZoneId.of("Asia/Seoul"));
        for (Map.Entry<String, List<Transition>> entry : bySite.entrySet()) {
            List<Transition> siteAlerts = entry.getValue();
            List<Long> eventIds = siteAlerts.stream().map(Transition::eventId).toList();
            List<String> webhooks = recipients.activeWebhooks(entry.getKey(), now);
            String fallback = properties.monitor().slackWebhookUrl();
            if (webhooks.isEmpty() && !recipients.hasConfiguredWebhooks(entry.getKey())
                && fallback != null && !fallback.isBlank()) webhooks = List.of(fallback);
            if (webhooks.isEmpty()) {
                alertEvents.markDelivery(eventIds, "SKIPPED", null, 0);
                continue;
            }
            String text = "[MREyes " + siteAlerts.get(0).siteName() + " 알림 " + siteAlerts.size() + "건]";
            try {
                for (String webhook : webhooks) {
                    restClient.post().uri(webhook).contentType(MediaType.APPLICATION_JSON)
                        .body(Map.of("text", text, "alerts", siteAlerts)).retrieve().toBodilessEntity();
                }
                alertEvents.markDelivery(eventIds, "SENT", null, webhooks.size());
            } catch (RuntimeException error) {
                String message = error.getMessage() == null ? "Slack delivery failed" : error.getMessage();
                alertEvents.markDelivery(eventIds, "FAILED",
                    message.substring(0, Math.min(message.length(), 1000)), webhooks.size());
                throw error;
            }
        }
    }
}
