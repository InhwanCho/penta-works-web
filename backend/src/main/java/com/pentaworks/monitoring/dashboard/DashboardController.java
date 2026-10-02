package com.pentaworks.monitoring.dashboard;

import com.pentaworks.monitoring.auth.CurrentUserService;
import com.pentaworks.monitoring.company.CompanyMetricService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/dashboard")
public class DashboardController {
    private final DashboardService dashboardService;
    private final CurrentUserService currentUsers;
    private final CompanyMetricService metrics;
    public DashboardController(DashboardService dashboardService, CurrentUserService currentUsers, CompanyMetricService metrics) {
        this.dashboardService = dashboardService;
        this.currentUsers = currentUsers;
        this.metrics = metrics;
    }

    @GetMapping
    public DashboardResponse getDashboard(Authentication authentication) {
        var user = currentUsers.require(authentication);
        return dashboardService.getDashboard(currentUsers.visibleSiteIds(user), user.id()).withMetrics(metrics.metrics(user.companyId()));
    }
}
