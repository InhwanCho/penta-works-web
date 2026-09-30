package com.pentaworks.monitoring.admin;

import com.pentaworks.monitoring.config.MailProperties;
import jakarta.mail.MessagingException;
import java.io.UnsupportedEncodingException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
public class AccountMailService {
    private static final Logger log = LoggerFactory.getLogger(AccountMailService.class);
    private final JavaMailSender sender;
    private final MailProperties properties;

    public AccountMailService(JavaMailSender sender, MailProperties properties) {
        this.sender = sender;
        this.properties = properties;
    }

    public DeliveryStatus sendInvitation(String email, String name, String token) {
        return send(email, "[MREyes] 계정 초대",
            name + "님, MREyes에 초대되었습니다.\n\n아래 링크에서 7일 이내에 비밀번호를 설정해주세요.\n" +
                link("/accept-invite", token));
    }

    public DeliveryStatus sendPasswordReset(String email, String name, String token) {
        return send(email, "[MREyes] 비밀번호 재설정",
            name + "님, 비밀번호 재설정 요청이 생성되었습니다.\n\n아래 링크는 1시간 동안 유효합니다.\n" +
                link("/reset-password", token));
    }

    private DeliveryStatus send(String email, String subject, String text) {
        if (!properties.enabled()) return DeliveryStatus.DISABLED;
        if (blank(properties.from()) || blank(properties.publicBaseUrl())) {
            log.error("Account email is enabled but sender or public base URL is missing");
            return DeliveryStatus.FAILED;
        }
        try {
            var message = sender.createMimeMessage();
            var helper = new MimeMessageHelper(message, false, StandardCharsets.UTF_8.name());
            if (blank(properties.fromName())) {
                helper.setFrom(properties.from().trim());
            } else {
                helper.setFrom(properties.from().trim(), properties.fromName().trim());
            }
            helper.setTo(email);
            helper.setSubject(subject);
            helper.setText(text);
            sender.send(message);
            return DeliveryStatus.SENT;
        } catch (MailException | MessagingException | UnsupportedEncodingException | IllegalArgumentException error) {
            log.error("Account email delivery failed ({})", error.getClass().getSimpleName());
            return DeliveryStatus.FAILED;
        }
    }

    private String link(String path, String token) {
        String base = properties.publicBaseUrl() == null ? "" : properties.publicBaseUrl().trim();
        while (base.endsWith("/")) base = base.substring(0, base.length() - 1);
        return base + path + "?token=" + URLEncoder.encode(token, StandardCharsets.UTF_8);
    }

    private static boolean blank(String value) { return value == null || value.isBlank(); }
    public enum DeliveryStatus { SENT, FAILED, DISABLED }
}
