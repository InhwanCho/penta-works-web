package com.pentaworks.monitoring.monitoring;

import com.pentaworks.monitoring.alert.AlertService;
import com.pentaworks.monitoring.alert.AlertThreshold;
import com.pentaworks.monitoring.alert.SiteAlertSettings;
import com.pentaworks.monitoring.alert.AlertEventService;
import com.pentaworks.monitoring.alert.AlertEventService.Transition;
import com.pentaworks.monitoring.alert.AlertRecipientService;
import com.pentaworks.monitoring.alert.AlertDeliveryService;
import com.pentaworks.monitoring.common.BadRequestException;
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
import org.springframework.web.client.RestClientResponseException;
import org.springframework.http.client.SimpleClientHttpRequestFactory;

@Service
public class MonitorService {
    private static final Logger log = LoggerFactory.getLogger(MonitorService.class);
    private final DashboardService dashboardService;
    private final AlertService alertService;
    private final AlertEventService alertEvents;
    private final AlertRecipientService recipients;
    private final AppProperties properties;
    private final RestClient restClient;
    private final AlertDeliveryService deliveries;

    public MonitorService(DashboardService dashboardService, AlertService alertService,
                          AlertEventService alertEvents, AlertRecipientService recipients,
                          AppProperties properties, AlertDeliveryService deliveries) {
        this.dashboardService = dashboardService;
        this.alertService = alertService;
        this.alertEvents = alertEvents;
        this.recipients = recipients;
        this.properties = properties;
        this.deliveries = deliveries;
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(3000);
        factory.setReadTimeout(10000);
        this.restClient = RestClient.builder().requestFactory(factory).build();
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
        SiteAlertSettings policy = alertService.alertSettings().stream()
            .filter(site -> site.siteid().equals(transition.siteId())).findFirst()
            .orElseThrow(() -> new BadRequestException("사업장 알림 설정이 없습니다."));
        if (!policy.alertsEnabled()) throw new BadRequestException("알림 사용을 먼저 켜주세요.");
        sendSlack(List.of(transition), Map.of(transition.siteId(), policy), true);
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
            if (policy != null && !deliveryAllowed(policy, now)) {
                if (manual) throw new BadRequestException("현재는 알림 제외 시간입니다.");
                alertEvents.markDelivery(eventIds, "SKIPPED", "알림 제외 시간", 0);
                continue;
            }
            List<String> webhooks = recipients.activeWebhooks(entry.getKey(), now.toLocalTime());
            String fallback = properties.monitor().slackWebhookUrl();
            if (webhooks.isEmpty() && !recipients.hasConfiguredWebhooks(entry.getKey())
                && recipients.allowsGlobalFallback(entry.getKey())
                && fallback != null && !fallback.isBlank()) webhooks = List.of(fallback);
            if (webhooks.isEmpty()) {
                String reason = recipients.hasConfiguredWebhooks(entry.getKey())
                    ? "사용 가능한 수신 채널이 없습니다. 채널 사용 여부와 제외 시간을 확인해주세요."
                    : "등록된 수신 채널이 없습니다.";
                if (manual) throw new BadRequestException(reason);
                alertEvents.markDelivery(eventIds, "SKIPPED", reason, 0);
                continue;
            }
            Map<Long, AlertDeliveryService.Batch> batches = new LinkedHashMap<>();
            for (Transition alert : siteAlerts) {
                var batch = deliveries.begin(alert.eventId(), webhooks, manual);
                if (batch != null) batches.put(alert.eventId(), batch);
            }
            if (manual && batches.size() != siteAlerts.size()) {
                throw new BadRequestException("이미 처리 중이거나 현재 재시도할 수 없는 알림입니다.");
            }
            for (String webhook : webhooks) {
                List<Transition> pending = siteAlerts.stream().filter(alert ->
                    batches.containsKey(alert.eventId()) && deliveries.claim(batches.get(alert.eventId()), webhook)).toList();
                if (pending.isEmpty()) continue;
                String status = "SENT";
                String errorMessage = null;
                try {
                    String text = "[MREyes " + pending.get(0).siteName() + " 알림 " + pending.size() + "건]";
                    restClient.post().uri(webhook).contentType(MediaType.APPLICATION_JSON)
                        .body(Map.of("text", text, "alerts", pending)).retrieve().toBodilessEntity();
                } catch (RestClientResponseException error) {
                    status = "FAILED";
                    errorMessage = "수신 채널이 전송을 거부했습니다 (HTTP " + error.getStatusCode().value() + ").";
                } catch (RuntimeException error) {
                    status = "UNKNOWN";
                    errorMessage = "응답을 확인할 수 없습니다. 수신 채널에서 도착 여부를 확인해주세요.";
                    log.warn("Alert delivery response unavailable for site {}", entry.getKey());
                }
                for (Transition alert : pending) deliveries.complete(batches.get(alert.eventId()), webhook, status, errorMessage);
            }
            batches.values().forEach(deliveries::finish);
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
