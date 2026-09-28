package com.pentaworks.monitoring.auth;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth/password-resets")
public class PasswordResetController {
    private final PasswordResetService service;
    public PasswordResetController(PasswordResetService service) { this.service = service; }

    @GetMapping("/{token}")
    public ResetInfo info(@PathVariable String token) { return service.info(token); }

    @PostMapping("/{token}")
    public ResponseEntity<Void> reset(@PathVariable String token, @Valid @RequestBody ResetRequest request) {
        service.reset(token, request.password());
        return ResponseEntity.noContent().build();
    }

    public record ResetRequest(@NotBlank @Size(min = 12, max = 128) String password) {}
    public record ResetInfo(String email, String name) {}
}
