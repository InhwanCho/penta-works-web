package com.pentaworks.monitoring.admin;

import com.pentaworks.monitoring.config.MailProperties;
import jakarta.mail.Session;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import java.util.Properties;
import org.junit.jupiter.api.Test;
import org.springframework.mail.javamail.JavaMailSender;
import org.mockito.ArgumentCaptor;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class AccountMailServiceTest {
    @Test
    void doesNotContactSmtpWhenMailIsDisabled() {
        JavaMailSender sender = mock(JavaMailSender.class);
        AccountMailService service = new AccountMailService(sender,
            new MailProperties(false, "ihcho@pentaworks.net", "펜타웍스 알림 (회신불가)", "https://app.example.com"));

        assertEquals(AccountMailService.DeliveryStatus.DISABLED,
            service.sendInvitation("user@example.com", "User", "secret"));
        verifyNoInteractions(sender);
    }

    @Test
    void sendsPasswordResetWithDisplayNameWhenMailIsConfigured() throws Exception {
        JavaMailSender sender = mock(JavaMailSender.class);
        when(sender.createMimeMessage()).thenReturn(new MimeMessage(Session.getInstance(new Properties())));
        AccountMailService service = new AccountMailService(sender,
            new MailProperties(true, "ihcho@pentaworks.net", "펜타웍스 알림 (회신불가)", "https://app.example.com/"));

        assertEquals(AccountMailService.DeliveryStatus.SENT,
            service.sendPasswordReset("user@example.com", "User", "a+b"));
        ArgumentCaptor<MimeMessage> sent = ArgumentCaptor.forClass(MimeMessage.class);
        verify(sender).send(sent.capture());
        InternetAddress from = (InternetAddress) sent.getValue().getFrom()[0];
        assertEquals("ihcho@pentaworks.net", from.getAddress());
        assertEquals("펜타웍스 알림 (회신불가)", from.getPersonal());
    }
}
