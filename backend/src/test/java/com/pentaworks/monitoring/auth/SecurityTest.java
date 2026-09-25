package com.pentaworks.monitoring.auth;

import com.pentaworks.monitoring.config.AppProperties;
import com.pentaworks.monitoring.config.SecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.test.web.servlet.MockMvc;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = SecurityTest.Probe.class, properties = {
    "app.jwt.secret=test-only-random-secret-with-at-least-32-bytes",
    "app.jwt.expiration-minutes=5", "app.cors.allowed-origins=http://localhost:3000",
    "app.office-integration.enabled=false"
})
@Import({SecurityConfig.class, JwtTokens.class, SecurityTest.Probe.class})
class SecurityTest {
    @Autowired MockMvc mvc;
    @Autowired JwtTokens tokens;

    @RestController
    static class Probe {
        @GetMapping("/api/v1/probe") String data() { return "ok"; }
        @GetMapping("/api/v1/admin/probe") String admin() { return "ok"; }
        @GetMapping("/api/v1/sites/001/office-assets") String officeAssets() { return "ok"; }
        @GetMapping("/api/v1/sites/001/office-assets/maintenance/2/photos/3") String officePhoto() { return "ok"; }
        @GetMapping({
            "/api/v1/dashboard",
            "/api/v1/sites",
            "/api/v1/sites/1",
            "/api/v1/alerts/psi-thresholds"
        }) String publicRead() { return "ok"; }
    }

    @Test void readOnlyDashboardEndpointsArePublic() throws Exception {
        mvc.perform(get("/api/v1/dashboard")).andExpect(status().isOk());
        mvc.perform(get("/api/v1/sites")).andExpect(status().isOk());
        mvc.perform(get("/api/v1/sites/1")).andExpect(status().isOk());
        mvc.perform(get("/api/v1/alerts/psi-thresholds")).andExpect(status().isOk());
    }

    @Test void anonymousIsRejected() throws Exception {
        mvc.perform(get("/api/v1/probe")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/sites/001/office-assets")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/sites/001/office-assets/maintenance/2/photos/3"))
            .andExpect(status().isUnauthorized());
    }
    @Test void validTokenIsAccepted() throws Exception {
        mvc.perform(get("/api/v1/probe").header("Authorization", "Bearer " + tokens.issue("alice", "user")))
            .andExpect(status().isOk());
    }
    @Test void malformedTokenIsRejected() throws Exception {
        mvc.perform(get("/api/v1/probe").header("Authorization", "Bearer invalid"))
            .andExpect(status().isUnauthorized());
    }
    @Test void wrongSignatureIsRejected() throws Exception {
        JwtTokens other = new JwtTokens(new AppProperties(null,
            new AppProperties.Jwt("different-secret-with-at-least-32-bytes", 5), null, null));
        mvc.perform(get("/api/v1/probe").header("Authorization", "Bearer " + other.issue("alice", "user")))
            .andExpect(status().isUnauthorized());
    }
    @Test void userCannotAccessAdmin() throws Exception {
        mvc.perform(get("/api/v1/admin/probe").header("Authorization", "Bearer " + tokens.issue("alice", "user")))
            .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/admin/probe").header("Authorization", "Bearer " + tokens.issue("alice", "admin")))
            .andExpect(status().isOk());
    }
    @Test void expiredTokenIsRejected() throws Exception {
        var key = io.jsonwebtoken.security.Keys.hmacShaKeyFor(
            "test-only-random-secret-with-at-least-32-bytes".getBytes(java.nio.charset.StandardCharsets.UTF_8));
        String token = io.jsonwebtoken.Jwts.builder().subject("alice").claim("role", "user")
            .expiration(java.util.Date.from(java.time.Instant.now().minusSeconds(60))).signWith(key).compact();
        mvc.perform(get("/api/v1/probe").header("Authorization", "Bearer " + token))
            .andExpect(status().isUnauthorized());
    }
    @Test void weakSecretFailsClosed() {
        assertThrows(IllegalArgumentException.class, () -> new JwtTokens(new AppProperties(null,
            new AppProperties.Jwt("replace-with-at-least-32-random-characters", 5), null, null)));
        assertThrows(io.jsonwebtoken.security.WeakKeyException.class, () -> new JwtTokens(new AppProperties(null,
            new AppProperties.Jwt("short", 5), null, null)));
    }
}
