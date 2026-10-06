package com.pentaworks.monitoring.alert;

import com.pentaworks.monitoring.auth.CurrentUserService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;
import java.time.LocalTime;
import java.time.LocalDate;
import java.util.Map;
import com.pentaworks.monitoring.monitoring.MonitorService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PostMapping;

@RestController
@RequestMapping("/api/v1/alerts")
public class AlertController {
    private final AlertService alertService;
    private final PersonalAlertService personal;
    private final AlertEventService alertEvents;
    private final CurrentUserService currentUsers;
    private final MonitorService monitorService;
    private final AlertDeliveryService deliveries;
    public AlertController(AlertService alertService, AlertEventService alertEvents, CurrentUserService currentUsers,
                           MonitorService monitorService, AlertDeliveryService deliveries, PersonalAlertService personal) {
        this.personal=personal;
        this.alertService = alertService;
        this.alertEvents = alertEvents;
        this.currentUsers = currentUsers;
        this.monitorService = monitorService;
        this.deliveries = deliveries;
    }
    @GetMapping("/psi-thresholds")
    public List<PsiThreshold> psiThresholds(Authentication authentication) {
        var user = currentUsers.require(authentication);
        return personal.settings(user).stream().map(s->{var t=s.thresholds().stream().filter(v->v.key().equals("hepres")).findFirst().orElseThrow();return new PsiThreshold(s.siteid(),s.name(),t.effectiveMin(),t.effectiveMax(),t.active());}).toList();
    }

    @GetMapping("/thresholds")
    public List<SiteAlertSettings> thresholds(Authentication authentication) {
        var user = currentUsers.require(authentication);
        return personal.settings(user);
    }

    @GetMapping("/company-thresholds")
    public List<AlertThreshold> companyThresholds(Authentication authentication) {
        return alertService.companyThresholds(currentUsers.require(authentication));
    }

    @PatchMapping("/company-thresholds")
    public List<AlertThreshold> updateCompanyThresholds(
        @Valid @RequestBody @NotEmpty List<@Valid ThresholdUpdateRequest> request,
        Authentication authentication) {
        return alertService.updateCompanyThresholds(currentUsers.require(authentication),
            request.stream().map(value -> new AlertService.ThresholdUpdate(
                value.key(), value.min(), value.max(), value.active())).toList());
    }

    @PostMapping("/thresholds/{siteId}/restore-company")
    public SiteAlertSettings restoreCompanyThresholds(@PathVariable String siteId,
                                                       Authentication authentication) {
        return personal.reset(currentUsers.require(authentication), siteId);
    }

    @PatchMapping("/policy/{siteId}")
    public SiteAlertSettings updatePolicy(@PathVariable String siteId,
                                          @Valid @RequestBody UpdatePolicyRequest request,
                                          Authentication authentication) {
        return personal.enabled(currentUsers.require(authentication), siteId, request.enabled());
    }

    @PatchMapping("/thresholds/{siteId}/metrics/{metricKey}")
    public SiteAlertSettings updateMetric(@PathVariable String siteId, @PathVariable String metricKey,
                                           @Valid @RequestBody ThresholdRequest request, Authentication authentication) {
        return personal.metric(currentUsers.require(authentication), siteId, metricKey, request);
    }

    @PatchMapping("/thresholds/{siteId}")
    public SiteAlertSettings updateThresholds(@PathVariable String siteId,
                                              @Valid @RequestBody UpdateAlertThresholdsRequest request,
                                              Authentication authentication) {
        return personal.save(currentUsers.require(authentication),siteId,request);
    }

    @GetMapping("/events")
    public List<AlertEventSummary> events(@RequestParam(defaultValue = "200") int limit,
                                          Authentication authentication) {
        var user = currentUsers.require(authentication);
        return alertEvents.events(user.isAdmin()
            ? currentUsers.allowedSiteIds(user) : currentUsers.visibleSiteIds(user), limit, user.id());
    }

    @PatchMapping("/events/{eventId}/acknowledge")
    public AlertEventSummary acknowledge(@PathVariable long eventId, Authentication authentication) {
        return alertEvents.acknowledge(currentUsers.require(authentication), eventId);
    }

    @GetMapping("/events/{eventId}/deliveries")
    public List<AlertDeliveryService.Result> deliveryResults(@PathVariable long eventId, Authentication authentication) {
        var user = currentUsers.require(authentication);
        var allowed = user.isAdmin() ? currentUsers.allowedSiteIds(user) : currentUsers.visibleSiteIds(user);
        alertEvents.requireEventAccess(eventId, user);
        return deliveries.results(eventId);
    }

    @PatchMapping("/events/acknowledge")
    public Map<String, Object> acknowledgeMany(@Valid @RequestBody AcknowledgeEventsRequest request,
                                                Authentication authentication) {
        int count = alertEvents.acknowledgeMany(currentUsers.require(authentication), request.eventIds());
        return Map.of("ok", true, "count", count);
    }

    @PatchMapping("/events/{eventId}/deliveries/{resultId}")
    public Map<String, Boolean> resolveDelivery(@PathVariable long eventId, @PathVariable long resultId,
                                               @Valid @RequestBody DeliveryConfirmation request,
                                               Authentication authentication) {
        var user = currentUsers.require(authentication);
        alertEvents.requireEventAccess(eventId, user);
        deliveries.resolve(user, eventId, resultId, request.received());
        return Map.of("ok", true);
    }

    public record DeliveryConfirmation(@NotNull Boolean received) {}

    @PostMapping("/events/{eventId}/retry")
    public Map<String, Object> retry(@PathVariable long eventId, Authentication authentication) {
        return monitorService.retry(currentUsers.require(authentication), eventId);
    }

    @PatchMapping("/psi-thresholds/{siteId}")
    public PsiThreshold updatePsiThreshold(@PathVariable String siteId,
                                           @Valid @RequestBody UpdatePsiThresholdRequest request,
                                           Authentication authentication) {
        var s=personal.metric(currentUsers.require(authentication),siteId,"hepres",new ThresholdRequest(request.min(),request.max(),request.active(),null,null));
        var t=s.thresholds().stream().filter(v->v.key().equals("hepres")).findFirst().orElseThrow();
        return new PsiThreshold(s.siteid(),s.name(),t.effectiveMin(),t.effectiveMax(),t.active());
    }

    @GetMapping("/patterns/targets")
    public List<PersonalAlertService.ShareTarget> targets(@RequestParam String siteId,Authentication authentication) {
        return personal.targets(currentUsers.require(authentication),siteId);
    }
    @GetMapping("/patterns/shared")
    public List<PersonalAlertService.Share> shared(@RequestParam(defaultValue="true") boolean inbox,Authentication authentication) {
        return personal.shares(currentUsers.require(authentication),inbox);
    }
    @PostMapping("/patterns/{siteId}/share")
    public PersonalAlertService.Share share(@PathVariable String siteId,@Valid @RequestBody ShareRequest request,Authentication authentication) {
        return personal.share(currentUsers.require(authentication),siteId,request.recipientId());
    }
    @PostMapping("/patterns/shared/{id}/apply")
    public SiteAlertSettings apply(@PathVariable long id,Authentication authentication) {
        return personal.apply(currentUsers.require(authentication),id);
    }
    public record ShareRequest(@NotNull Long recipientId) {}

    public record UpdatePsiThresholdRequest(@NotNull Double min, @NotNull Double max,
                                            @NotNull Boolean active) {}
    public record UpdateAlertThresholdsRequest(@NotEmpty List<@Valid ThresholdUpdateRequest> thresholds,
                                               @NotNull Integer noDataMinutes,
                                               @NotNull Boolean noDataActive,
                                               @NotNull Boolean alertsEnabled,
                                               @NotNull Integer triggerAfterMinutes,
                                               @NotNull Integer repeatMinutes,
                                               LocalTime quietStart,
                                               LocalTime quietEnd,
                                               @NotNull Boolean suppressWeekends,
                                               @NotNull List<@NotNull LocalDate> holidayDates,
                                               Boolean coldChillerActive,
                                               Integer collectionIntervalMinutes,
                                               Integer missingCollectionThreshold) {}
    public record ThresholdUpdateRequest(@NotBlank String key, @NotNull Double min, @NotNull Double max,
                                         @NotNull Boolean active, Boolean useAverage,
                                         Double tolerancePercent) {}
    public record ThresholdRequest(@NotNull Double min, @NotNull Double max, @NotNull Boolean active,
                                   Boolean useAverage, Double tolerancePercent) {}
    public record UpdatePolicyRequest(@NotNull Boolean enabled) {}
    public record AcknowledgeEventsRequest(@NotEmpty List<@NotNull Long> eventIds) {}
}
