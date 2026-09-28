package com.pentaworks.monitoring.alert;

import com.pentaworks.monitoring.auth.CurrentUserService;
import java.util.List;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
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
}
