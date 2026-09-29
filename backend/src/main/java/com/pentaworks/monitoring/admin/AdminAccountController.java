package com.pentaworks.monitoring.admin;

import com.pentaworks.monitoring.auth.CurrentUserService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import java.time.Instant;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/accounts")
public class AdminAccountController {
    private final AdminAccountService service;
    private final CurrentUserService currentUsers;

    public AdminAccountController(AdminAccountService service, CurrentUserService currentUsers) {
        this.service = service;
        this.currentUsers = currentUsers;
    }

    @GetMapping("/users")
    public List<UserSummary> users(Authentication authentication) {
        return service.users(currentUsers.require(authentication));
    }

    @GetMapping("/sites")
    public List<SiteOption> sites(Authentication authentication) {
        return service.sites(currentUsers.require(authentication));
    }

    @PostMapping("/sites")
    public SiteOption createSite(@Valid @RequestBody CreateSiteRequest request,
                                 Authentication authentication) {
        return service.createSite(currentUsers.require(authentication), request);
    }

    @PatchMapping("/sites/{siteId}")
    public SiteOption updateSite(@PathVariable String siteId, @Valid @RequestBody UpdateSiteRequest request,
                                 Authentication authentication) {
        return service.updateSite(currentUsers.require(authentication), siteId, request);
    }

    @GetMapping("/invitations")
    public List<InvitationSummary> invitations(Authentication authentication) {
        return service.invitations(currentUsers.require(authentication));
    }

    @GetMapping("/audit-logs")
    public List<AuditSummary> auditLogs(Authentication authentication) {
        return service.auditLogs(currentUsers.require(authentication));
    }

    @PostMapping("/invitations")
    public InvitationCreated invite(@Valid @RequestBody InviteRequest request, Authentication authentication) {
        return service.invite(currentUsers.require(authentication), request);
    }

    @DeleteMapping("/invitations/{id}")
    public ResponseEntity<Void> revokeInvitation(@PathVariable String id, Authentication authentication) {
        service.revokeInvitation(currentUsers.require(authentication), id);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/users/{id}")
    public UserSummary update(@PathVariable long id, @Valid @RequestBody UpdateUserRequest request,
                              Authentication authentication) {
        return service.updateUser(currentUsers.require(authentication), id, request);
    }

    @PostMapping("/users/{id}/password-reset")
    public PasswordResetCreated passwordReset(@PathVariable long id, Authentication authentication) {
        return service.createPasswordReset(currentUsers.require(authentication), id);
    }

    public record InviteRequest(@NotBlank @Email String email, @NotBlank String name,
                                @NotBlank String role, List<String> siteIds) {}
    public record UpdateUserRequest(@NotBlank String role, @NotBlank String status, List<String> siteIds) {}
    public record UserSummary(long id, String email, String name, String role, String status,
                              Instant lastLoginAt, Instant createdAt, List<String> siteIds) {}
    public record CreateSiteRequest(@NotBlank String id, @NotBlank String name, String address,
                                    String contactName, String contactPhone, String timezone) {}
    public record UpdateSiteRequest(@NotBlank String name, String address, String contactName,
                                    String contactPhone, String timezone) {}
    public record SiteOption(String id, String name, String address, String contactName,
                             String contactPhone, String timezone) {}
    public record InvitationSummary(String id, String email, String name, String role,
                                    Instant expiresAt, Instant createdAt, List<String> siteIds) {}
    public record InvitationCreated(String id, String token, String email, Instant expiresAt) {}
    public record AuditSummary(long id, String actorName, String action, String targetType,
                               String targetId, Instant createdAt) {}
    public record PasswordResetCreated(String token, String email, Instant expiresAt) {}
}
