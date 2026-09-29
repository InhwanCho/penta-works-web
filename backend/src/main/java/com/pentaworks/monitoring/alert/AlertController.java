package com.pentaworks.monitoring.alert;

import com.pentaworks.monitoring.auth.CurrentUserService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/alerts")
public class AlertController {
    private final AlertService alertService;
    private final AlertEventService alertEvents;
    private final CurrentUserService currentUsers;
    public AlertController(AlertService alertService, AlertEventService alertEvents, CurrentUserService currentUsers) {
        this.alertService = alertService;
        this.alertEvents = alertEvents;
        this.currentUsers = currentUsers;
    }
    @GetMapping("/psi-thresholds")
    public List<PsiThreshold> psiThresholds(Authentication authentication) {
        var user = currentUsers.require(authentication);
        return alertService.psiThresholds(currentUsers.allowedSiteIds(user));
    }

    @GetMapping("/thresholds")
    public List<SiteAlertSettings> thresholds(Authentication authentication) {
        var user = currentUsers.require(authentication);
        return alertService.alertSettings(currentUsers.allowedSiteIds(user));
    }

    @PatchMapping("/thresholds/{siteId}")
    public SiteAlertSettings updateThresholds(@PathVariable String siteId,
                                              @Valid @RequestBody UpdateAlertThresholdsRequest request,
                                              Authentication authentication) {
        List<AlertService.ThresholdUpdate> updates = request.thresholds().stream()
            .map(value -> new AlertService.ThresholdUpdate(value.key(), value.min(), value.max(), value.active()))
            .toList();
        return alertService.updateAlertSettings(currentUsers.require(authentication), siteId, updates,
            request.noDataMinutes(), request.noDataActive());
    }

    @GetMapping("/events")
    public List<AlertEventSummary> events(@RequestParam(defaultValue = "200") int limit,
                                          Authentication authentication) {
        var user = currentUsers.require(authentication);
        return alertEvents.events(currentUsers.allowedSiteIds(user), limit);
    }

    @PatchMapping("/events/{eventId}/acknowledge")
    public AlertEventSummary acknowledge(@PathVariable long eventId, Authentication authentication) {
        return alertEvents.acknowledge(currentUsers.require(authentication), eventId);
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
                                               @NotNull Boolean noDataActive) {}
    public record ThresholdUpdateRequest(@NotBlank String key, @NotNull Double min, @NotNull Double max,
                                         @NotNull Boolean active) {}
}
