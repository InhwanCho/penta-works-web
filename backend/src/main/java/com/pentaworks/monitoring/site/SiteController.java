package com.pentaworks.monitoring.site;

import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/sites")
public class SiteController {
    private final SiteService siteService;
    public SiteController(SiteService siteService) { this.siteService = siteService; }

    @GetMapping
    public List<SiteResponse.SiteSummary> list() { return siteService.list(); }

    @GetMapping("/{siteid}")
    public SiteResponse detail(@PathVariable String siteid, @RequestParam(defaultValue = "200") int take) {
        return siteService.detail(siteid, take);
    }
}
