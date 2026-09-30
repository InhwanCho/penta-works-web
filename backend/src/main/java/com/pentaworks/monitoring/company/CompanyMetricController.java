package com.pentaworks.monitoring.company;

import com.pentaworks.monitoring.auth.CurrentUserService;
import java.util.List;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class CompanyMetricController {
    private final CompanyMetricService service;
    private final CurrentUserService users;
    public CompanyMetricController(CompanyMetricService service, CurrentUserService users) { this.service = service; this.users = users; }
    @GetMapping("/api/v1/company/metrics")
    public List<CompanyMetricService.Metric> metrics(Authentication authentication) {
        return service.metrics(users.require(authentication).companyId());
    }
    @PatchMapping("/api/v1/company/metrics")
    public List<CompanyMetricService.Metric> save(Authentication authentication, @RequestBody List<CompanyMetricService.Metric> request) {
        return service.save(users.require(authentication), request);
    }
}
