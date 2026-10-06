package com.pentaworks.monitoring.auth;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth/invitations")
public class InvitationController {
    private final InvitationService service;

    public InvitationController(InvitationService service) { this.service = service; }

    @GetMapping("/{token}")
    public InvitationInfo info(@PathVariable String token) { return service.info(token); }

    @PostMapping("/{token}/accept")
    public ResponseEntity<Void> accept(@PathVariable String token, @Valid @RequestBody AcceptRequest request) {
        service.accept(token, request.password());
        return ResponseEntity.noContent().build();
    }

    public record AcceptRequest(@NotBlank @Size(min = 8, max = 128) String password) {}
    public record InvitationInfo(String email, String name, String role, Instant expiresAt, String companyName) {}
}
