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
    private final com.pentaworks.monitoring.alert.PersonalAlertService personal;
    public DashboardController(DashboardService dashboardService, CurrentUserService currentUsers, CompanyMetricService metrics, com.pentaworks.monitoring.alert.PersonalAlertService personal) {
        this.personal=personal;
        this.dashboardService = dashboardService;
        this.currentUsers = currentUsers;
        this.metrics = metrics;
    }

    @GetMapping
    public DashboardResponse getDashboard(Authentication authentication) {
        var user = currentUsers.require(authentication);
        return personal.dashboard(user,dashboardService.getDashboard(currentUsers.visibleSiteIds(user))).withMetrics(metrics.metrics(user.companyId()));
    }
}
