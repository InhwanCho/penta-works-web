package com.pentaworks.monitoring.auth;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class PasswordResetRequestController {
    private final PasswordResetRequestService service;
    public PasswordResetRequestController(PasswordResetRequestService service) { this.service = service; }

    @PostMapping("/api/v1/auth/password-resets/request")
    public ResponseEntity<Void> request(@Valid @RequestBody Request request) {
        service.request(request.email());
        // Identical response for unknown, inactive, throttled and deliverable accounts.
        return ResponseEntity.noContent().build();
    }

    public record Request(@NotBlank @Email @Size(max = 254) String email) {}
}
