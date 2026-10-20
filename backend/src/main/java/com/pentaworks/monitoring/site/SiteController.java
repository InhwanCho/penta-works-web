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

    @org.springframework.beans.factory.annotation.Autowired
    private org.springframework.beans.factory.ObjectProvider<com.pentaworks.monitoring.workspace.WorkspaceHospitals> hospitals;

    @GetMapping
    public List<SiteResponse.SiteSummary> list(Authentication authentication) {
        var user = currentUsers.require(authentication);
        return siteService.list(currentUsers.visibleSiteIds(user));
    }

    @GetMapping("/{siteid}")
    public SiteResponse detail(@PathVariable String siteid, @RequestParam(defaultValue = "200") int take,
                               @RequestParam(defaultValue = "1") int page,
                               @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
                               @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
                               Authentication authentication) {
        var user = currentUsers.require(authentication);
        // Dashboard visibility controls the monitoring list; assigned hospitals still have service detail pages.
        currentUsers.requireSiteAccess(user, SiteService.normalizeSiteId(siteid));
        var registry=hospitals==null?null:hospitals.getIfAvailable();
        if(registry!=null) {
            String canonical=registry.canonicalSite(user.companyId(),SiteService.normalizeSiteId(siteid));
            currentUsers.requireSiteAccess(user,canonical);
            var binding=registry.binding(user.companyId(),canonical);
            return siteService.detail(canonical,take,from,to,page,binding.monitoringSiteId()).withMetrics(metrics.metrics(user.companyId())).withHospital(binding.hospitalId(),binding.monitoringSiteId(),binding.name());
        }
        return siteService.detail(siteid, take, from, to, page).withMetrics(metrics.metrics(user.companyId()));
    }
}
