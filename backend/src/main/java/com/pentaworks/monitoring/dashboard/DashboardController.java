package com.pentaworks.monitoring.dashboard;

import com.pentaworks.monitoring.auth.CurrentUserService;
import com.pentaworks.monitoring.company.CompanyMetricService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/dashboard")
public class DashboardController {
    private final DashboardVisibilityService visibility;
    private final DashboardService dashboardService;
    private final CurrentUserService currentUsers;
    private final CompanyMetricService metrics;
    private final com.pentaworks.monitoring.alert.PersonalAlertService personal;
    public DashboardController(DashboardService dashboardService, CurrentUserService currentUsers, CompanyMetricService metrics, com.pentaworks.monitoring.alert.PersonalAlertService personal, DashboardVisibilityService visibility) {
        this.visibility=visibility;
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
    @GetMapping("/hidden-sites")
    public List<String> hiddenSites(Authentication authentication) {
        return visibility.hiddenSites(currentUsers.require(authentication));
    }

    @PutMapping("/hidden-sites/{siteId}")
    public List<String> setHidden(Authentication authentication, @PathVariable String siteId, @Valid @RequestBody VisibilityUpdate request) {
        return visibility.setHidden(currentUsers.require(authentication), siteId, request.hidden());
    }

    @DeleteMapping("/hidden-sites")
    public List<String> restoreAll(Authentication authentication) {
        return visibility.restoreAll(currentUsers.require(authentication));
    }

    public record VisibilityUpdate(@NotNull Boolean hidden) {}

}
