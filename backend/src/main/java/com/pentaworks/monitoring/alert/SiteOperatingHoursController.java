package com.pentaworks.monitoring.alert;
import com.pentaworks.monitoring.auth.CurrentUserService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
@RestController
@RequestMapping("/api/v1/alerts/operating-hours")
public class SiteOperatingHoursController {
    private final SiteOperatingHoursService hours; private final CurrentUserService users;
    public SiteOperatingHoursController(SiteOperatingHoursService hours,CurrentUserService users){this.hours=hours;this.users=users;}
    @GetMapping public Map<String,SiteOperatingHoursService.View> list(Authentication auth){return hours.views(users.require(auth));}
    @GetMapping("/calendar") public Map<String,Object> calendar(Authentication auth){users.require(auth);return hours.calendar();}
    @PatchMapping("/{siteId}") public SiteOperatingHoursService.View save(@PathVariable String siteId,@RequestBody SiteOperatingHours settings,Authentication auth){return hours.save(users.require(auth),siteId,settings);}
}
