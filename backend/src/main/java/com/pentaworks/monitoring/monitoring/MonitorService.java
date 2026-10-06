package com.pentaworks.monitoring.monitoring;

import com.pentaworks.monitoring.alert.AlertService;
import com.pentaworks.monitoring.alert.AlertThreshold;
import com.pentaworks.monitoring.alert.SiteAlertSettings;
import com.pentaworks.monitoring.alert.AlertEventService;
import com.pentaworks.monitoring.alert.AlertEventService.Transition;
import com.pentaworks.monitoring.alert.AlertRecipientService;
import com.pentaworks.monitoring.alert.AlertDeliveryService;
import com.pentaworks.monitoring.alert.BaroKakaoService;
import com.pentaworks.monitoring.common.BadRequestException;
import com.pentaworks.monitoring.auth.CurrentUserService.CurrentUser;
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
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientResponseException;

@Service
public class MonitorService {
    private static final Logger log = LoggerFactory.getLogger(MonitorService.class);
    private final DashboardService dashboardService;
    private final AlertService alertService;
    private final AlertEventService alertEvents;
    private final AlertRecipientService recipients;
    private final AlertDeliveryService deliveries;
    private final BaroKakaoService kakao;

    public MonitorService(DashboardService dashboardService, AlertService alertService,
                          AlertEventService alertEvents, AlertRecipientService recipients,
                          AlertDeliveryService deliveries, BaroKakaoService kakao) {
        this.dashboardService = dashboardService;
        this.alertService = alertService;
        this.alertEvents = alertEvents;
        this.recipients = recipients;
        this.deliveries = deliveries;
        this.kakao = kakao;
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
            if (site.noDataActive() && com.pentaworks.monitoring.alert.CollectionHealth.isMissing(
                row.lagMin(), site.collectionIntervalMinutes(), site.missingCollectionThreshold())) continue;
            Transition coldChiller = alertEvents.evaluateColdChiller(site, row.metrics().get("cctemp"), row.metrics().get("ccflow"));
            if (coldChiller != null) transitions.add(coldChiller);
            for (AlertThreshold threshold : site.thresholds()) {
                Double value = row.metrics().get(threshold.key());
                if (!threshold.active()) continue;
                Transition transition = alertEvents.evaluate(site, threshold, value);
                if (transition != null) transitions.add(transition);
            }
        }
        if (!transitions.isEmpty()) dashboardService.invalidateCache();
        sendNotifications(transitions, settings, false);
        return Map.of("ok", true, "count", transitions.size(), "alerts", transitions);
    }

    public Map<String, Object> retry(CurrentUser actor, long eventId) {
        Transition transition = alertEvents.retryTransition(actor, eventId);
        SiteAlertSettings policy = alertService.alertSettings().stream()
            .filter(site -> site.siteid().equals(transition.siteId())).findFirst()
            .orElseThrow(() -> new BadRequestException("병원 알림 설정이 없습니다."));
        if (!policy.alertsEnabled()) throw new BadRequestException("알림 사용을 먼저 켜주세요.");
        sendNotifications(List.of(transition), Map.of(transition.siteId(), policy), true);
        return Map.of("ok", true, "eventId", eventId);
    }

    private void sendNotifications(List<Transition> alerts, Map<String, SiteAlertSettings> settings, boolean manual) {
        if (alerts.isEmpty()) return;
        List<Transition> recoveries = alerts.stream().filter(alert -> "RECOVERY".equals(alert.eventType())).toList();
        if (!recoveries.isEmpty()) {
            if (manual) throw new BadRequestException("정상 복구 알림톡 템플릿은 아직 등록되지 않았습니다.");
            alertEvents.markDelivery(recoveries.stream().map(Transition::eventId).toList(),
                "SKIPPED", "정상 복구 알림톡 템플릿이 등록되지 않았습니다.", 0);
        }
        Map<String, List<Transition>> bySite = alerts.stream().filter(alert -> !"RECOVERY".equals(alert.eventType()))
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
            List<String> phones = recipients.activePhones(entry.getKey(), now.toLocalTime());
            List<String> destinations = new ArrayList<>();
            phones.forEach(phone -> destinations.add("KAKAO_ALIMTALK:" + phone));
            if (destinations.isEmpty()) {
                String reason = recipients.hasConfiguredPhones(entry.getKey())
                    ? "사용 가능한 수신 채널이 없습니다. 채널 사용 여부와 제외 시간을 확인해주세요."
                    : "등록된 수신 채널이 없습니다.";
                if (manual) throw new BadRequestException(reason);
                alertEvents.markDelivery(eventIds, "SKIPPED", reason, 0);
                continue;
            }
            Map<Long, AlertDeliveryService.Batch> batches = new LinkedHashMap<>();
            Map<Long, List<String>> eligible = new LinkedHashMap<>();
            for (Transition alert : siteAlerts) {
                List<String> eventPhones = recipients.activePhones(entry.getKey(), now.toLocalTime(), alert.eventId());
                eligible.put(alert.eventId(), eventPhones);
                if (eventPhones.isEmpty()) continue;
                var batch = deliveries.begin(alert.eventId(), eventPhones.stream().map(phone -> "KAKAO_ALIMTALK:" + phone).toList(), manual);
                if (batch != null) batches.put(alert.eventId(), batch);
            }
            if (manual && batches.size() != siteAlerts.size()) {
                throw new BadRequestException("이미 처리 중이거나 현재 재시도할 수 없는 알림입니다.");
            }
            for (String phone : phones) {
                String destination = "KAKAO_ALIMTALK:" + phone;
                for (Transition alert : siteAlerts) {
                    var batch = batches.get(alert.eventId());
                    if (!eligible.getOrDefault(alert.eventId(), List.of()).contains(phone)) continue;
                    if (batch == null || !deliveries.claim(batch, destination)) continue;
                    try {
                        String receipt = kakao.send(phone, alert);
                        deliveries.accepted(batch, destination, receipt);
                    } catch (IllegalStateException error) {
                        deliveries.complete(batch, destination, "FAILED", error.getMessage());
                    } catch (RestClientResponseException error) {
                        deliveries.complete(batch, destination, "FAILED",
                            "바로빌 접수 거부 (HTTP " + error.getStatusCode().value() + ")");
                    } catch (RuntimeException error) {
                        deliveries.complete(batch, destination, "UNKNOWN",
                            "바로빌 응답을 확인할 수 없습니다. 중복 발송 방지를 위해 도착 여부를 확인해주세요.");
                        log.warn("Kakao delivery response unavailable for site {}", entry.getKey());
                    }
                }
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
