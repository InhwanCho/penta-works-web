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
    private final AlertEventService alertEvents;
    private final CurrentUserService currentUsers;
    private final MonitorService monitorService;
    public AlertController(AlertService alertService, AlertEventService alertEvents, CurrentUserService currentUsers,
                           MonitorService monitorService) {
        this.alertService = alertService;
        this.alertEvents = alertEvents;
        this.currentUsers = currentUsers;
        this.monitorService = monitorService;
    }
    @GetMapping("/psi-thresholds")
    public List<PsiThreshold> psiThresholds(Authentication authentication) {
        var user = currentUsers.require(authentication);
        return alertService.psiThresholds(user.isAdmin()
            ? currentUsers.allowedSiteIds(user) : currentUsers.visibleSiteIds(user));
    }

    @GetMapping("/thresholds")
    public List<SiteAlertSettings> thresholds(Authentication authentication) {
        var user = currentUsers.require(authentication);
        return alertService.alertSettings(user.isAdmin()
            ? currentUsers.allowedSiteIds(user) : currentUsers.visibleSiteIds(user));
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
        return alertService.restoreCompanyThresholds(currentUsers.require(authentication), siteId);
    }

    @PatchMapping("/policy/{siteId}")
    public SiteAlertSettings updatePolicy(@PathVariable String siteId,
                                          @Valid @RequestBody UpdatePolicyRequest request,
                                          Authentication authentication) {
        return alertService.setAlertsEnabled(currentUsers.require(authentication), siteId, request.enabled());
    }

    @PatchMapping("/thresholds/{siteId}")
    public SiteAlertSettings updateThresholds(@PathVariable String siteId,
                                              @Valid @RequestBody UpdateAlertThresholdsRequest request,
                                              Authentication authentication) {
        List<AlertService.ThresholdUpdate> updates = request.thresholds().stream()
            .map(value -> new AlertService.ThresholdUpdate(value.key(), value.min(), value.max(),
                value.active(), value.useAverage(), value.tolerancePercent()))
            .toList();
        return alertService.updateAlertSettings(currentUsers.require(authentication), siteId, updates,
            request.noDataMinutes(), request.noDataActive(), request.alertsEnabled(),
            request.triggerAfterMinutes(), request.repeatMinutes(), request.quietStart(), request.quietEnd(),
            request.suppressWeekends(), request.holidayDates());
    }

    @GetMapping("/events")
    public List<AlertEventSummary> events(@RequestParam(defaultValue = "200") int limit,
                                          Authentication authentication) {
        var user = currentUsers.require(authentication);
        return alertEvents.events(user.isAdmin()
            ? currentUsers.allowedSiteIds(user) : currentUsers.visibleSiteIds(user), limit);
    }

    @PatchMapping("/events/{eventId}/acknowledge")
    public AlertEventSummary acknowledge(@PathVariable long eventId, Authentication authentication) {
        return alertEvents.acknowledge(currentUsers.require(authentication), eventId);
    }

    @PatchMapping("/events/acknowledge")
    public Map<String, Object> acknowledgeMany(@Valid @RequestBody AcknowledgeEventsRequest request,
                                                Authentication authentication) {
        int count = alertEvents.acknowledgeMany(currentUsers.require(authentication), request.eventIds());
        return Map.of("ok", true, "count", count);
    }

    @PostMapping("/events/{eventId}/retry")
    public Map<String, Object> retry(@PathVariable long eventId, Authentication authentication) {
        return monitorService.retry(currentUsers.require(authentication), eventId);
    }

    @PatchMapping("/psi-thresholds/{siteId}")
    public PsiThreshold updatePsiThreshold(@PathVariable String siteId,
                                           @Valid @RequestBody UpdatePsiThresholdRequest request,
                                           Authentication authentication) {
        return alertService.updatePsiThreshold(currentUsers.require(authentication), siteId,
            request.min(), request.max(), request.active());
    }

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
                                               @NotNull List<@NotNull LocalDate> holidayDates) {}
    public record ThresholdUpdateRequest(@NotBlank String key, @NotNull Double min, @NotNull Double max,
                                         @NotNull Boolean active, Boolean useAverage,
                                         Double tolerancePercent) {}
    public record UpdatePolicyRequest(@NotNull Boolean enabled) {}
    public record AcknowledgeEventsRequest(@NotEmpty List<@NotNull Long> eventIds) {}
}
