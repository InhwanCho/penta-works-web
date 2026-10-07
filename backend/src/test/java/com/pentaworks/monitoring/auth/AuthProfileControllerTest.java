package com.pentaworks.monitoring.auth;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class AuthProfileControllerTest {
    @Test
    void profileRequestCannotChangeNameEmailOrRole() throws Exception {
        var service = mock(AuthService.class);
        when(service.updateProfile("alice@example.com", "01012345678"))
            .thenReturn(new AuthService.Profile("alice@example.com", "Alice", "01012345678"));
        var mvc = MockMvcBuilders.standaloneSetup(new AuthController(service)).build();
        mvc.perform(patch("/api/v1/auth/profile")
            .principal(new UsernamePasswordAuthenticationToken("alice@example.com", "unused"))
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"email":"other@example.com","name":"Other","role":"SUPER_ADMIN","phone":"01012345678"}
                """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("email").value("alice@example.com"))
            .andExpect(jsonPath("name").value("Alice"))
            .andExpect(jsonPath("phone").value("01012345678"));
        verify(service).updateProfile("alice@example.com", "01012345678");
        verifyNoMoreInteractions(service);
    }
}
