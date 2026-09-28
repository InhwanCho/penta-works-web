package com.pentaworks.monitoring.alert;

import com.pentaworks.monitoring.auth.CurrentUserService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/alerts")
public class AlertController {
    private final AlertService alertService;
    private final CurrentUserService currentUsers;
    public AlertController(AlertService alertService, CurrentUserService currentUsers) {
        this.alertService = alertService;
        this.currentUsers = currentUsers;
    }
    @GetMapping("/psi-thresholds")
    public List<PsiThreshold> psiThresholds(Authentication authentication) {
        var user = currentUsers.require(authentication);
        return alertService.psiThresholds(currentUsers.allowedSiteIds(user));
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
}
