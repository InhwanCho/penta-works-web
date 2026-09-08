package com.pentaworks.monitoring.alert;

import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/alerts")
public class AlertController {
    private final AlertService alertService;
    public AlertController(AlertService alertService) { this.alertService = alertService; }
    @GetMapping("/psi-thresholds")
    public List<PsiThreshold> psiThresholds() { return alertService.psiThresholds(); }
}
