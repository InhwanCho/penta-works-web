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
    void soapTransportPreservesKoreanTemplateNameAndMessage() {
        var builder = org.springframework.web.client.RestClient.builder();
        var server = org.springframework.test.web.client.MockRestServiceServer.bindTo(builder).build();
        var service = new BaroKakaoService(true, "key", "1234567890", "sender", "01012345678", false);
        var alert = new Transition(1, "001", "순천향병", "achumi", "항온항습기 습도", "%", "LOW", 24.8, 25.22, 75.67, "이탈");
        String xml = service.request("01099998888", alert, ZonedDateTime.now());
        server.expect(org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo("https://ws.baroservice.com/KAKAOTALK.asmx"))
            .andExpect(org.springframework.test.web.client.match.MockRestRequestMatchers.header("Content-Type", "text/xml;charset=UTF-8"))
            .andExpect(org.springframework.test.web.client.match.MockRestRequestMatchers.content().bytes(xml.getBytes(StandardCharsets.UTF_8)))
            .andRespond(org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess("accepted", org.springframework.http.MediaType.TEXT_XML));
        assertEquals("accepted", BaroKakaoService.postSoap(builder.build(), "SendATKakaotalkEx", xml));
        server.verify();
    }

    @Test
    void groupedAlertsUseApprovedTemplateAndNameEachItemValueAndType() {
        var service=new BaroKakaoService(true,"test-key","1234567890","sender","01012345678",false);
        var pressure=new Transition(1,"001","테스트 병원","hepres","헬륨 압력 측정 누락","회","METRIC_MISSING",5.0,null,5.0,"누락");
        var temperature=new Transition(2,"001","테스트 병원","actemp","항온항습기 온도 측정 누락","회","METRIC_MISSING",6.0,null,3.0,"누락");
        var humidity=new Transition(3,"001","테스트 병원","achumi","항온항습기 습도","%","HIGH",90.0,null,70.0,"이탈");
        var noData=new Transition(4,"001","테스트 병원","__data__","데이터 수집 5회 연속 누락","분","NO_DATA",50.0,null,50.0,"누락");
        String request=service.bundleRequest("01099998888",java.util.List.of(pressure,temperature,humidity,noData),ZonedDateTime.now());
        assertTrue(request.contains("감지항목: 헬륨 압력, 항온항습기 온도, 항온항습기 습도, 데이터 수집 5회 연속 누락"));
        assertTrue(request.contains("현재값: 헬륨 압력 [항목 누락] 5회\n항온항습기 온도 [항목 누락] 6회"));
        assertTrue(request.contains("항온항습기 습도 [상한 초과] 90%"));
        assertTrue(request.contains("데이터 수집 5회 연속 누락 [수집 누락] 50분"));
        assertTrue(request.contains("<TemplateName>MRI 상태 이상 감지</TemplateName>"));
        var other=new Transition(3,"002","다른 병원","hepres","압력","회","METRIC_MISSING",5.0,null,5.0,"누락");
        org.junit.jupiter.api.Assertions.assertThrows(IllegalArgumentException.class,()->service.bundleRequest("01099998888",java.util.List.of(pressure,other),ZonedDateTime.now()));
    }

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
        assertTrue(request.contains("<Message>[MReyes 모니터링 알림]\n\n병원명: 테스트 병원\n감지항목: He Pressure\n현재값: 3.25psi\n감지시각: 2026-09-30 12:00 (수)\n\n담당자님, 상세 내용을 확인해주세요.</Message>"));
        assertTrue(service.ready());
        assertTrue(request.contains("<SmsReply>A</SmsReply>"));
        assertTrue(request.contains("<SmsMessage>[MRI] 테스트 병원 He Pressure 3.25psi</SmsMessage>"));
        assertTrue(request.contains("<TemplateName>MRI 상태 이상 감지</TemplateName>"));
        assertTrue(request.contains("<ReceiverNum>01099998888</ReceiverNum>"));
        assertTrue(request.contains("감지시각: 2026-09-30 12:00 (수)"));
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
