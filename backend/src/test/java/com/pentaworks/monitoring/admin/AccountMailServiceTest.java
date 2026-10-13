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
    void invitationExplainsThatTheInvitedEmailIsTheLoginId() throws Exception {
        JavaMailSender sender = mock(JavaMailSender.class);
        when(sender.createMimeMessage()).thenReturn(new MimeMessage(Session.getInstance(new Properties())));
        var service = new AccountMailService(sender,
            new MailProperties(true, "ihcho@pentaworks.net", "펜타웍스 알림", "https://app.example.com"));
        assertEquals(AccountMailService.DeliveryStatus.SENT, service.sendInvitation("user@example.com", "User", "test-token"));
        var sent = ArgumentCaptor.forClass(MimeMessage.class);
        verify(sender).send(sent.capture());
        String body = sent.getValue().getContent().toString();
        org.junit.jupiter.api.Assertions.assertTrue(body.contains("로그인 ID: user@example.com"));
        org.junit.jupiter.api.Assertions.assertTrue(body.contains("초대받은 이메일 주소가 로그인 ID입니다."));
    }

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
        String body = sent.getValue().getContent().toString();
        org.junit.jupiter.api.Assertions.assertTrue(body.contains("본인이 요청하지 않았다면"));
        org.junit.jupiter.api.Assertions.assertTrue(body.contains("1시간 동안 유효"));
        org.junit.jupiter.api.Assertions.assertTrue(body.contains("https://app.example.com/reset-password?token=a%2Bb"));
        org.junit.jupiter.api.Assertions.assertTrue(body.contains("서비스 주소: https://app.example.com\n"));
    }
}
