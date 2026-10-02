package com.pentaworks.monitoring.alert;

import com.pentaworks.monitoring.alert.AlertEventService.Transition;
import java.nio.charset.StandardCharsets;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class BaroKakaoServiceTest {
    @Test
    void fallbackContainsSiteMetricAndValueWithinNinetyBytes() {
        Transition alert = new Transition(1, "001", "아주 긴 사업장 이름 테스트 병원", "hepres",
            "헬륨 압력 측정값", "psi", "HIGH", 3.25, 0.5, 2.0, "이상");
        String sms = BaroKakaoService.sms(alert);
        assertTrue(sms.getBytes(StandardCharsets.UTF_8).length <= 90);
        assertTrue(sms.contains("헬륨 압력 측정값"));
        assertTrue(sms.contains("3.25psi"));
    }

    @Test
    void requestUsesApprovedTemplateAndCustomSmsFallbackOnly() {
        BaroKakaoService service = new BaroKakaoService(true, "test-key", "1234567890", "sender", "01012345678", false);
        Transition alert = new Transition(1, "001", "테스트 병원", "hepres", "He Pressure",
            "psi", "HIGH", 3.25, 0.5, 2.0, "이상");
        String request = service.request("01099998888", alert,
            ZonedDateTime.of(2026, 9, 30, 12, 0, 0, 0, ZoneId.of("Asia/Seoul")));
        assertTrue(service.ready());
        assertTrue(request.contains("<SmsReply>A</SmsReply>"));
        assertTrue(request.contains("<SmsMessage>[MRI] 테스트 병원 He Pressure 3.25psi</SmsMessage>"));
        assertTrue(request.contains("<TemplateName>MRI 장비 상태 이상 감지 알림 - 간소화</TemplateName>"));
        assertTrue(request.contains("<ReceiverNum>01099998888</ReceiverNum>"));
        assertTrue(request.contains("감지 시각: 2026-09-30 12:00 (수)"));
        assertTrue(request.contains("<Url1>https://app.pentaworks.net/?scrollTo=001</Url1>"));
        assertFalse(new BaroKakaoService(false, "", "", "", "", false).ready());
    }

    @Test
    void approvedDeepLinkUsesSiteIdForBothKakaoButtonUrls() {
        BaroKakaoService service = new BaroKakaoService(true, "test-key", "1234567890", "sender", "01012345678", true);
        Transition alert = new Transition(1, "006", "테스트 병원", "hepres", "He Pressure",
            "psi", "HIGH", 3.25, 0.5, 2.0, "이상");
        String request = service.request("01099998888", alert,
            ZonedDateTime.of(2026, 9, 30, 12, 0, 0, 0, ZoneId.of("Asia/Seoul")));
        assertTrue(request.contains("<Url1>https://app.pentaworks.net/?scrollTo=006</Url1>"));
        assertTrue(request.contains("<Url2>https://app.pentaworks.net/?scrollTo=006</Url2>"));
    }

    @Test
    void parsesProviderKakaoFailureAndSmsFallbackState() {
        String response = """
            <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
              <soap:Body><GetSendKakaotalkExResponse xmlns="http://ws.baroservice.com/">
                <GetSendKakaotalkExResult><SendStatus>2</SendStatus><ResultCode>2</ResultCode>
                  <ResultMessage>카카오톡 전송 실패</ResultMessage><SmsSendState>전송성공</SmsSendState>
                </GetSendKakaotalkExResult>
              </GetSendKakaotalkExResponse></soap:Body>
            </soap:Envelope>
            """;
        BaroKakaoService.ProviderStatus result = BaroKakaoService.parseStatus(response);
        assertEquals(2, result.sendStatus());
        assertEquals("전송성공", result.smsSendState());
    }
}
