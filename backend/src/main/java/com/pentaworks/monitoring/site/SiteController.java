package com.pentaworks.monitoring.site;

import com.pentaworks.monitoring.auth.CurrentUserService;
import java.util.List;
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
    public SiteController(SiteService siteService, CurrentUserService currentUsers) {
        this.siteService = siteService;
        this.currentUsers = currentUsers;
    }

    @GetMapping
    public List<SiteResponse.SiteSummary> list(Authentication authentication) {
        var user = currentUsers.require(authentication);
        return siteService.list(currentUsers.visibleSiteIds(user));
    }

    @GetMapping("/{siteid}")
    public SiteResponse detail(@PathVariable String siteid, @RequestParam(defaultValue = "200") int take,
                               Authentication authentication) {
        var user = currentUsers.require(authentication);
        currentUsers.requireVisibleSiteAccess(user, SiteService.normalizeSiteId(siteid));
        return siteService.detail(siteid, take);
    }
}
