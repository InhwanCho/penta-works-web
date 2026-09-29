package com.pentaworks.monitoring.auth;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import java.time.Instant;
import java.util.List;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    static final String REFRESH_COOKIE = "mreyes_refresh";

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request,
                                                HttpServletRequest servletRequest) {
        AuthService.AuthResult result = authService.login(
            request.email(), request.password(), clientIp(servletRequest), servletRequest.getHeader("User-Agent"));
        return withRefreshCookie(result);
    }

    @PostMapping("/refresh")
    public ResponseEntity<LoginResponse> refresh(HttpServletRequest request) {
        AuthService.AuthResult result = authService.refresh(
            cookie(request, REFRESH_COOKIE), clientIp(request), request.getHeader("User-Agent"));
        return withRefreshCookie(result);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request, HttpServletResponse response) {
        authService.logout(cookie(request, REFRESH_COOKIE));
        response.addHeader(HttpHeaders.SET_COOKIE, authService.clearRefreshCookie().toString());
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }

    @PostMapping("/change-password")
    public ResponseEntity<Void> changePassword(@Valid @RequestBody ChangePasswordRequest request,
                                                Authentication authentication, HttpServletResponse response) {
        authService.changePassword(authentication.getName(), request.currentPassword(), request.newPassword());
        response.addHeader(HttpHeaders.SET_COOKIE, authService.clearRefreshCookie().toString());
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }

    @GetMapping("/sessions")
    public List<AuthService.SessionSummary> sessions(Authentication authentication,
                                                     HttpServletRequest request) {
        return authService.sessions(authentication.getName(), cookie(request, REFRESH_COOKIE));
    }

    @DeleteMapping("/sessions/{sessionId}")
    public ResponseEntity<Void> revokeSession(@PathVariable String sessionId, Authentication authentication,
                                              HttpServletRequest request, HttpServletResponse response) {
        boolean current = authService.revokeSession(authentication.getName(), sessionId,
            cookie(request, REFRESH_COOKIE));
        if (current) response.addHeader(HttpHeaders.SET_COOKIE, authService.clearRefreshCookie().toString());
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }

    @PostMapping("/sessions/revoke-others")
    public ResponseEntity<Void> revokeOtherSessions(Authentication authentication, HttpServletRequest request) {
        authService.revokeOtherSessions(authentication.getName(), cookie(request, REFRESH_COOKIE));
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }

    private ResponseEntity<LoginResponse> withRefreshCookie(AuthService.AuthResult result) {
        return ResponseEntity.ok()
            .cacheControl(CacheControl.noStore())
            .header(HttpHeaders.SET_COOKIE, authService.refreshCookie(result.refreshToken()).toString())
            .body(result.response());
    }

    private static String cookie(HttpServletRequest request, String name) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return null;
        for (Cookie cookie : cookies) if (name.equals(cookie.getName())) return cookie.getValue();
        return null;
    }

    private static String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) return forwarded.split(",", 2)[0].trim();
        return request.getRemoteAddr();
    }

    public record LoginRequest(@NotBlank @Email String email, @NotBlank String password) {}
    public record ChangePasswordRequest(@NotBlank String currentPassword, @NotBlank String newPassword) {}
    public record LoginResponse(String accessToken, Instant accessTokenExpiresAt, SessionUser user) {}
    public record SessionUser(long id, String email, String name, String role) {}
}
