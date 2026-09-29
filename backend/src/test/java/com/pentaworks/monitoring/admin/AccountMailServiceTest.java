package com.pentaworks.monitoring.admin;

import com.pentaworks.monitoring.config.MailProperties;
import org.junit.jupiter.api.Test;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

class AccountMailServiceTest {
    @Test
    void doesNotContactSmtpWhenMailIsDisabled() {
        JavaMailSender sender = mock(JavaMailSender.class);
        AccountMailService service = new AccountMailService(sender,
            new MailProperties(false, "noreply@example.com", "https://app.example.com"));

        assertEquals(AccountMailService.DeliveryStatus.DISABLED,
            service.sendInvitation("user@example.com", "User", "secret"));
        verifyNoInteractions(sender);
    }

    @Test
    void sendsPasswordResetWhenMailIsConfigured() {
        JavaMailSender sender = mock(JavaMailSender.class);
        AccountMailService service = new AccountMailService(sender,
            new MailProperties(true, "noreply@example.com", "https://app.example.com/"));

        assertEquals(AccountMailService.DeliveryStatus.SENT,
            service.sendPasswordReset("user@example.com", "User", "a+b"));
        verify(sender).send(any(SimpleMailMessage.class));
    }
}
