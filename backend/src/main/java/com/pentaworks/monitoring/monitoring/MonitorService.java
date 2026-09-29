package com.pentaworks.monitoring.monitoring;

import com.pentaworks.monitoring.alert.AlertService;
import com.pentaworks.monitoring.alert.AlertThreshold;
import com.pentaworks.monitoring.alert.SiteAlertSettings;
import com.pentaworks.monitoring.alert.AlertEventService;
import com.pentaworks.monitoring.alert.AlertEventService.Transition;
import com.pentaworks.monitoring.alert.AlertRecipientService;
import com.pentaworks.monitoring.auth.CurrentUserService.CurrentUser;
import com.pentaworks.monitoring.config.AppProperties;
import com.pentaworks.monitoring.dashboard.DashboardResponse;
import com.pentaworks.monitoring.dashboard.DashboardService;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.time.LocalTime;
import java.time.ZonedDateTime;
import java.time.ZoneId;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
public class MonitorService {
    private static final Logger log = LoggerFactory.getLogger(MonitorService.class);
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
            if (row.name() == null || site == null || !site.dashboardVisible() || !site.alertsEnabled()) continue;
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
        if (!transitions.isEmpty()) dashboardService.invalidateCache();
        sendSlack(transitions, settings, false);
        return Map.of("ok", true, "count", transitions.size(), "alerts", transitions);
    }

    public Map<String, Object> retry(CurrentUser actor, long eventId) {
        Transition transition = alertEvents.retryTransition(actor, eventId);
        sendSlack(List.of(transition), Map.of(), true);
        return Map.of("ok", true, "eventId", eventId);
    }

    private void sendSlack(List<Transition> alerts, Map<String, SiteAlertSettings> settings, boolean manual) {
        if (alerts.isEmpty()) return;
        Map<String, List<Transition>> bySite = alerts.stream()
            .collect(Collectors.groupingBy(Transition::siteId, LinkedHashMap::new, Collectors.toList()));
        ZonedDateTime now = ZonedDateTime.now(ZoneId.of("Asia/Seoul"));
        for (Map.Entry<String, List<Transition>> entry : bySite.entrySet()) {
            List<Transition> siteAlerts = entry.getValue();
            List<Long> eventIds = siteAlerts.stream().map(Transition::eventId).toList();
            SiteAlertSettings policy = settings.get(entry.getKey());
            if (!manual && policy != null && !deliveryAllowed(policy, now)) {
                alertEvents.markDelivery(eventIds, "SKIPPED", "알림 제외 시간", 0);
                continue;
            }
            List<String> webhooks = recipients.activeWebhooks(entry.getKey(), now.toLocalTime());
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
                log.error("Alert delivery failed for site {}", entry.getKey(), error);
                if (manual) throw error;
            }
        }
    }

    static boolean deliveryAllowed(SiteAlertSettings policy, ZonedDateTime now) {
        if (policy.suppressWeekends() && now.getDayOfWeek().getValue() >= 6) return false;
        if (policy.holidayDates().contains(now.toLocalDate())) return false;
        LocalTime start = policy.quietStart();
        LocalTime end = policy.quietEnd();
        if (start == null || end == null || start.equals(end)) return true;
        LocalTime time = now.toLocalTime();
        boolean quiet = start.isBefore(end) ? !time.isBefore(start) && time.isBefore(end)
            : !time.isBefore(start) || time.isBefore(end);
        return !quiet;
    }
}
