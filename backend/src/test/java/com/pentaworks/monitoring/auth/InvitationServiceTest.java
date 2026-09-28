package com.pentaworks.monitoring.auth;

import com.pentaworks.monitoring.common.BadRequestException;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class InvitationServiceTest {
    @Test
    void enforcesStrongInvitationPassword() {
        assertThrows(BadRequestException.class, () -> InvitationService.validatePassword("short"));
        assertThrows(BadRequestException.class, () -> InvitationService.validatePassword("onlyletterslong"));
        assertDoesNotThrow(() -> InvitationService.validatePassword("StrongPassword123!"));
    }
}
