package com.pentaworks.monitoring.platform;

import com.pentaworks.monitoring.auth.CurrentUserService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/platform/companies")
public class PlatformCompanyController {
    private final PlatformCompanyService service;
    private final CurrentUserService currentUsers;

    public PlatformCompanyController(PlatformCompanyService service, CurrentUserService currentUsers) {
        this.service = service;
        this.currentUsers = currentUsers;
    }

    @GetMapping
    public List<CompanySummary> companies(Authentication authentication) {
        return service.companies(currentUsers.require(authentication));
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public CompanyCreated create(@Valid @ModelAttribute CreateCompanyRequest request,
                                 Authentication authentication) {
        return service.create(currentUsers.require(authentication), request);
    }

    @PostMapping("/{companyId}/invitation/resend")
    public InvitationCreated resend(@PathVariable long companyId, Authentication authentication) {
        return service.resend(currentUsers.require(authentication), companyId);
    }

    @PatchMapping("/{companyId}/status")
    public CompanySummary updateStatus(@PathVariable long companyId,
                                       @Valid @RequestBody UpdateStatusRequest request,
                                       Authentication authentication) {
        return service.updateStatus(currentUsers.require(authentication), companyId, request.status());
    }

    @PatchMapping("/{companyId}/business-registration/verify")
    public CompanySummary verifyRegistration(@PathVariable long companyId, Authentication authentication) {
        return service.verifyRegistration(currentUsers.require(authentication), companyId);
    }

    @GetMapping("/{companyId}/business-registration")
    public ResponseEntity<byte[]> registration(@PathVariable long companyId, Authentication authentication) {
        CompanyDocument document = service.registration(currentUsers.require(authentication), companyId);
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType(document.contentType()))
            .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline()
                .filename(document.originalName(), java.nio.charset.StandardCharsets.UTF_8).build().toString())
            .body(document.content());
    }

    public record CreateCompanyRequest(
        @NotBlank @Size(max = 120) String name,
        @NotBlank @Pattern(regexp = "[A-Za-z0-9_-]{2,64}") String code,
        @NotBlank @Pattern(regexp = "[0-9-]{10,12}") String businessRegistrationNumber,
        @NotBlank @Email @Size(max = 254) String adminEmail,
        @NotBlank @Size(max = 80) String adminName,
        MultipartFile businessRegistration) {}
    public record UpdateStatusRequest(@NotBlank String status) {}
    public record CompanySummary(long id, String code, String name, String businessRegistrationNumber,
                                 String businessRegistrationUrl, String status, Instant createdAt,
                                 Instant businessRegistrationUploadedAt, Instant businessRegistrationVerifiedAt,
                                 int siteCount, int userCount, int superAdminCount,
                                 String pendingInvitationId, String pendingAdminEmail,
                                 Instant pendingInvitationExpiresAt) {}
    public record CompanyCreated(CompanySummary company, String token, String email, Instant expiresAt,
                                 String deliveryStatus) {}
    public record InvitationCreated(String token, String email, Instant expiresAt, String deliveryStatus) {}
    public record CompanyDocument(byte[] content, String originalName, String contentType) {}
}
