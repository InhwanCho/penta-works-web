package com.pentaworks.monitoring.auth;

import com.pentaworks.monitoring.config.AppProperties;
import com.pentaworks.monitoring.config.SecurityConfig;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = SecurityTest.Probe.class, properties = {
    "app.jwt.secret=test-only-random-secret-with-at-least-32-bytes",
    "app.jwt.access-expiration-minutes=5",
    "app.jwt.refresh-expiration-days=365",
    "app.jwt.secure-cookie=false",
    "app.cors.allowed-origins=http://localhost:3000",
    "app.office-integration.enabled=false"
})
@Import({SecurityConfig.class, JwtTokens.class, SecurityTest.Probe.class})
class SecurityTest {
    @Autowired MockMvc mvc;
    @Autowired JwtTokens tokens;
    @MockitoBean SessionRegistry sessions;

    @BeforeEach
    void activeSession() {
        when(sessions.isActive(anyString(), anyLong())).thenReturn(true);
    }

    @RestController
    static class Probe {
        @GetMapping("/api/v1/probe") String data() { return "ok"; }
        @GetMapping("/api/v1/admin/probe") String admin() { return "ok"; }
        @GetMapping("/api/v1/dashboard") String dashboard() { return "ok"; }
        @GetMapping("/api/v1/auth/invitations/token") String invitation() { return "ok"; }
        @org.springframework.web.bind.annotation.PatchMapping("/api/v1/alerts/psi-thresholds/001")
        String updateThreshold() { return "ok"; }
        @org.springframework.web.bind.annotation.PostMapping("/api/v1/auth/change-password")
        String changePassword() { return "ok"; }
    }

    @Test void dashboardRequiresAuthentication() throws Exception {
        mvc.perform(get("/api/v1/dashboard")).andExpect(status().isUnauthorized());
    }

    @Test void invitationLookupIsPublicButPasswordChangeIsPrivate() throws Exception {
        mvc.perform(get("/api/v1/auth/invitations/token")).andExpect(status().isOk());
        mvc.perform(post("/api/v1/auth/change-password")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/auth/change-password").header("Authorization", "Bearer " + issue("USER")))
            .andExpect(status().isOk());
    }

    @Test void validTokenIsAccepted() throws Exception {
        mvc.perform(get("/api/v1/probe").header("Authorization", "Bearer " + issue("USER")))
            .andExpect(status().isOk());
    }

    @Test void malformedTokenIsRejected() throws Exception {
        mvc.perform(get("/api/v1/probe").header("Authorization", "Bearer invalid"))
            .andExpect(status().isUnauthorized());
    }

    @Test void wrongSignatureIsRejected() throws Exception {
        JwtTokens other = new JwtTokens(new AppProperties(null,
            new AppProperties.Jwt("different-secret-with-at-least-32-bytes", 5, 365, false), null, null));
        String token = other.issue(1, "alice@example.com", "Alice", "USER", "session").value();
        mvc.perform(get("/api/v1/probe").header("Authorization", "Bearer " + token))
            .andExpect(status().isUnauthorized());
    }

    @Test void onlyAdministratorsCanAccessAdmin() throws Exception {
        mvc.perform(get("/api/v1/admin/probe").header("Authorization", "Bearer " + issue("USER")))
            .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/admin/probe").header("Authorization", "Bearer " + issue("ADMIN")))
            .andExpect(status().isOk());
        mvc.perform(get("/api/v1/admin/probe").header("Authorization", "Bearer " + issue("SUPER_ADMIN")))
            .andExpect(status().isOk());
    }

    @Test void onlyAdministratorsCanUpdateAlertThresholds() throws Exception {
        mvc.perform(patch("/api/v1/alerts/psi-thresholds/001")
                .header("Authorization", "Bearer " + issue("USER")))
            .andExpect(status().isForbidden());
        mvc.perform(patch("/api/v1/alerts/psi-thresholds/001")
                .header("Authorization", "Bearer " + issue("ADMIN")))
            .andExpect(status().isOk());
        mvc.perform(patch("/api/v1/alerts/psi-thresholds/001")
                .header("Authorization", "Bearer " + issue("SUPER_ADMIN")))
            .andExpect(status().isOk());
    }

    @Test void expiredTokenIsRejected() throws Exception {
        var key = io.jsonwebtoken.security.Keys.hmacShaKeyFor(
            "test-only-random-secret-with-at-least-32-bytes".getBytes(java.nio.charset.StandardCharsets.UTF_8));
        String token = io.jsonwebtoken.Jwts.builder().subject("1")
            .claim("email", "alice@example.com").claim("role", "USER")
            .expiration(java.util.Date.from(java.time.Instant.now().minusSeconds(60))).signWith(key).compact();
        mvc.perform(get("/api/v1/probe").header("Authorization", "Bearer " + token))
            .andExpect(status().isUnauthorized());
    }

    @Test void weakSecretFailsClosed() {
        assertThrows(IllegalArgumentException.class, () -> new JwtTokens(new AppProperties(null,
            new AppProperties.Jwt("replace-with-at-least-32-random-characters", 5, 365, false), null, null)));
        assertThrows(io.jsonwebtoken.security.WeakKeyException.class, () -> new JwtTokens(new AppProperties(null,
            new AppProperties.Jwt("short", 5, 365, false), null, null)));
    }

    private String issue(String role) {
        return tokens.issue(1, "alice@example.com", "Alice", role, "session").value();
    }
}
