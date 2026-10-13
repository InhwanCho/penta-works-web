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
            name + "님, 안녕하세요.\n\n펜타웍스 MREyes 관리자가 병원 모니터링 서비스에 초대했습니다.\n\n" +
            "로그인 ID: " + email + "\n초대받은 이메일 주소가 로그인 ID입니다.\n" +
            "초대 링크는 7일 동안 유효합니다. 아래 주소에서 비밀번호를 설정한 뒤 로그인해주세요.\n\n" +
            link("/accept-invite", token) + "\n\n" +
            "초대를 예상하지 못했다면 링크를 열지 말고 사내 관리자에게 확인해주세요.\n" + footer());
    }

    public DeliveryStatus sendPasswordReset(String email, String name, String token) {
        return send(email, "[MREyes] 비밀번호 재설정",
            name + "님, 안녕하세요.\n\n펜타웍스 MREyes 계정의 비밀번호 재설정 요청을 받았습니다.\n\n" +
            "로그인 ID: " + email + "\n" +
            "아래 주소에서 새 비밀번호를 설정해주세요. 링크는 1시간 동안 유효합니다.\n\n" +
            link("/reset-password", token) + "\n\n" +
            "본인이 요청하지 않았다면 이 메일을 무시해주세요. 링크에서 변경을 완료하기 전까지 기존 비밀번호는 유지됩니다.\n" + footer());
    }

    private String footer() {
        return "\n이 메일은 MREyes의 계정 서비스에서 자동 발송되었습니다.\n" +
            "비밀번호나 인증정보를 이메일 답장으로 요청하지 않습니다.\n" +
            "서비스 주소: " + (properties.publicBaseUrl() == null ? "" : properties.publicBaseUrl().trim()).replaceAll("/+$", "") + "\n" +
            "문의가 필요하면 사내 MREyes 관리자에게 연락해주세요. 이 발신 주소는 회신을 확인하지 않습니다.\n";
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
