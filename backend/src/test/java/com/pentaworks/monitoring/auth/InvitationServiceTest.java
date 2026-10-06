package com.pentaworks.monitoring.auth;

import com.pentaworks.monitoring.common.BadRequestException;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class InvitationServiceTest {
    @Test
    @SuppressWarnings("unchecked")
    void acceptedInvitationCopiesMobileNumberToUser() throws Exception {
        var jdbc = org.mockito.Mockito.mock(org.springframework.jdbc.core.JdbcTemplate.class);
        var tokens = org.mockito.Mockito.mock(SecureTokens.class);
        var encoder = org.mockito.Mockito.mock(org.springframework.security.crypto.password.PasswordEncoder.class);
        org.mockito.Mockito.when(tokens.hash("token")).thenReturn("hash");
        org.mockito.Mockito.when(encoder.encode("StrongPassword123!")).thenReturn("encoded");
        org.mockito.Mockito.when(jdbc.query(org.mockito.ArgumentMatchers.anyString(),
            org.mockito.ArgumentMatchers.any(org.springframework.jdbc.core.ResultSetExtractor.class),
            org.mockito.ArgumentMatchers.eq("hash"))).thenAnswer(invocation -> {
                var rs = org.mockito.Mockito.mock(java.sql.ResultSet.class);
                org.mockito.Mockito.when(rs.next()).thenReturn(true);
                org.mockito.Mockito.when(rs.getString("id")).thenReturn("invitation-id");
                org.mockito.Mockito.when(rs.getLong("company_id")).thenReturn(1L);
                org.mockito.Mockito.when(rs.getString("email")).thenReturn("next@example.com");
                org.mockito.Mockito.when(rs.getString("name")).thenReturn("Next");
                org.mockito.Mockito.when(rs.getString("phone")).thenReturn("01012345678");
                org.mockito.Mockito.when(rs.getString("role")).thenReturn("USER");
                org.mockito.Mockito.when(rs.getString("company_name")).thenReturn("Inviting Company");
                org.mockito.Mockito.when(rs.getTimestamp("expires_at")).thenReturn(java.sql.Timestamp.from(java.time.Instant.now()));
                org.springframework.jdbc.core.ResultSetExtractor<?> extractor = invocation.getArgument(1);
                return extractor.extractData(rs);
            });
        org.mockito.Mockito.when(jdbc.queryForObject("SELECT id FROM app_user WHERE email=?", Long.class, "next@example.com")).thenReturn(2L);
        var service = new InvitationService(jdbc, tokens, encoder, org.mockito.Mockito.mock(com.pentaworks.monitoring.admin.AuditService.class));
        org.junit.jupiter.api.Assertions.assertEquals("Inviting Company", service.info("token").companyName());
        service.accept("token", "StrongPassword123!");
        org.mockito.Mockito.verify(jdbc).update(org.mockito.ArgumentMatchers.contains("INSERT INTO app_user"),
            org.mockito.ArgumentMatchers.eq(1L), org.mockito.ArgumentMatchers.eq("next@example.com"),
            org.mockito.ArgumentMatchers.eq("next@example.com"), org.mockito.ArgumentMatchers.eq("encoded"),
            org.mockito.ArgumentMatchers.eq("Next"), org.mockito.ArgumentMatchers.eq("01012345678"), org.mockito.ArgumentMatchers.eq("USER"));
    }

    @Test
    void acceptsSimplePasswordsWithEightCharacterMinimum() {
        assertThrows(BadRequestException.class, () -> InvitationService.validatePassword("short"));
        assertThrows(BadRequestException.class, () -> InvitationService.validatePassword("1234567"));
        assertThrows(BadRequestException.class, () -> InvitationService.validatePassword("        "));
        assertThrows(BadRequestException.class, () -> InvitationService.validatePassword(null));
        assertThrows(BadRequestException.class, () -> InvitationService.validatePassword("a".repeat(129)));
        assertDoesNotThrow(() -> InvitationService.validatePassword("12345678"));
        assertDoesNotThrow(() -> InvitationService.validatePassword("abcdefgh"));
        assertDoesNotThrow(() -> InvitationService.validatePassword("onlyletterslong"));
        assertDoesNotThrow(() -> InvitationService.validatePassword("a".repeat(128)));
        assertDoesNotThrow(() -> InvitationService.validatePassword("StrongPassword123!"));
    }
}
