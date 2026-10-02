package com.pentaworks.monitoring.site;

import com.pentaworks.monitoring.auth.CurrentUserService;
import com.pentaworks.monitoring.company.CompanyMetricService;
import java.util.List;
import java.time.Instant;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/sites")
public class SiteController {
    private final SiteService siteService;
    private final CurrentUserService currentUsers;
    private final CompanyMetricService metrics;
    public SiteController(SiteService siteService, CurrentUserService currentUsers, CompanyMetricService metrics) {
        this.siteService = siteService;
        this.currentUsers = currentUsers;
        this.metrics = metrics;
    }

    @GetMapping
    public List<SiteResponse.SiteSummary> list(Authentication authentication) {
        var user = currentUsers.require(authentication);
        return siteService.list(currentUsers.visibleSiteIds(user));
    }

    @GetMapping("/{siteid}")
    public SiteResponse detail(@PathVariable String siteid, @RequestParam(defaultValue = "200") int take,
                               @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
                               @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
                               Authentication authentication) {
        var user = currentUsers.require(authentication);
        currentUsers.requireVisibleSiteAccess(user, SiteService.normalizeSiteId(siteid));
        return siteService.detail(siteid, take, from, to).withMetrics(metrics.metrics(user.companyId()));
    }
}
