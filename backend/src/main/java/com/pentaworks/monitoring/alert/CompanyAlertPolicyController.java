package com.pentaworks.monitoring.alert;

import com.pentaworks.monitoring.auth.CurrentUserService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/alerts/company-policy")
public class CompanyAlertPolicyController {
    private final CompanyAlertPolicyService policies;
    private final CurrentUserService users;
    public CompanyAlertPolicyController(CompanyAlertPolicyService policies, CurrentUserService users) {
        this.policies=policies; this.users=users;
    }
    @GetMapping
    public CompanyAlertPolicyService.View get(Authentication auth) { return policies.view(users.require(auth)); }
    @PatchMapping
    public CompanyAlertPolicyService.View save(Authentication auth, @RequestBody CompanyAlertPolicyService.Saved input) {
        return policies.save(users.require(auth),input);
    }
}
