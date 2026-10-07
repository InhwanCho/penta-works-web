package com.pentaworks.monitoring.admin;

import com.pentaworks.monitoring.auth.CurrentUserService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
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

    @GetMapping("/company")
    public CompanySummary company(Authentication authentication) {
        return service.company(currentUsers.require(authentication));
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

    @PatchMapping("/sites/{siteId}/visibility")
    public SiteOption updateSiteVisibility(@PathVariable String siteId,
                                           @Valid @RequestBody UpdateSiteVisibilityRequest request,
                                           Authentication authentication) {
        return service.updateSiteVisibility(currentUsers.require(authentication), siteId, request.visible());
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

    @PostMapping("/invitations/{id}/resend")
    public InvitationCreated resendInvitation(@PathVariable String id, Authentication authentication) {
        return service.resendInvitation(currentUsers.require(authentication), id);
    }

    @PatchMapping("/users/{id}")
    public UserSummary update(@PathVariable long id, @Valid @RequestBody UpdateUserRequest request,
                              Authentication authentication) {
        return service.updateUser(currentUsers.require(authentication), id, request);
    }

    @DeleteMapping("/users/{id}")
    public ResponseEntity<Void> delete(@PathVariable long id, @Valid @RequestBody DeleteUserRequest request,
                                       Authentication authentication) {
        service.deleteUser(currentUsers.require(authentication), id, request.confirmationEmail());
        return ResponseEntity.noContent().build();
    }

    public record DeleteUserRequest(@NotBlank @Email @Size(max = 254) String confirmationEmail) {}

    @PostMapping("/users/{id}/password-reset")
    public PasswordResetCreated passwordReset(@PathVariable long id, Authentication authentication) {
        return service.createPasswordReset(currentUsers.require(authentication), id);
    }

    public record InviteRequest(@NotBlank @Email String email, @NotBlank @Size(max = 80) String name,
                                @NotBlank String role, List<String> siteIds, @Size(max = 30) String phone) {
        public InviteRequest(String email, String name, String role, List<String> siteIds) {
            this(email, name, role, siteIds, null);
        }
    }
    public record UpdateUserRequest(@NotBlank @Email String email, @NotBlank @Size(max = 80) String name,
                                    @Size(max = 30) String phone, @NotBlank String role,
                                    @NotBlank String status, List<String> siteIds) {}
    public record UserSummary(long id, String email, String name, String phone, String role, String status,
                              Instant lastLoginAt, Instant createdAt, List<String> siteIds) {}
    public record CreateSiteRequest(@NotBlank String id, @NotBlank String name, String address,
                                    String contactName, String contactPhone, String timezone) {}
    public record UpdateSiteRequest(@NotBlank String name, String address, String contactName,
                                    String contactPhone, String timezone) {}
    public record UpdateSiteVisibilityRequest(@jakarta.validation.constraints.NotNull Boolean visible) {}
    public record CompanySummary(long id, String code, String name) {}
    public record SiteOption(String id, String name, String address, String contactName,
                             String contactPhone, String timezone, long companyId,
                             String companyCode, String companyName, boolean dashboardVisible) {}
    public record InvitationSummary(String id, String email, String name, String phone, String role,
                                    Instant expiresAt, Instant createdAt, List<String> siteIds) {}
    public record InvitationCreated(String id, String token, String email, Instant expiresAt,
                                    String deliveryStatus) {}
    public record AuditSummary(long id, String actorName, String action, String targetType,
                               String targetId, String beforeData, String afterData,
                               String ipAddress, Instant createdAt) {}
    public record PasswordResetCreated(String token, String email, Instant expiresAt,
                                       String deliveryStatus) {}
}
