package com.pentaworks.monitoring.alert;

import com.pentaworks.monitoring.alert.AlertEventService.Transition;
import java.io.StringReader;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.w3c.dom.Document;
import org.xml.sax.InputSource;

@Service
public class BaroKakaoService {
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private static final DateTimeFormatter ALERT_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm (E)", Locale.KOREAN);
    private static final String ENDPOINT = "https://ws.baroservice.com/KAKAOTALK.asmx";
    private final RestClient client;
    private final boolean enabled;
    private final String certKey;
    private final String corpNum;
    private final String senderId;
    private final String smsSenderNum;
    private final boolean deepLinkEnabled;

    public BaroKakaoService(@Value("${BARO_KAKAO_ENABLED:false}") boolean enabled,
                            @Value("${BARO_CERT_KEY:}") String certKey,
                            @Value("${BARO_CORP_NUM:}") String corpNum,
                            @Value("${BARO_SENDER_ID:}") String senderId,
                            @Value("${BARO_SMS_SENDER_NUM:}") String smsSenderNum,
                            @Value("${BARO_KAKAO_DEEP_LINK_ENABLED:false}") boolean deepLinkEnabled) {
        this.enabled = enabled;
        this.certKey = certKey;
        this.corpNum = corpNum;
        this.senderId = senderId;
        this.smsSenderNum = smsSenderNum;
        this.deepLinkEnabled = deepLinkEnabled;
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(3));
        factory.setReadTimeout(Duration.ofSeconds(10));
        this.client = RestClient.builder().requestFactory(factory).build();
    }

    public boolean ready() {
        return enabled && !certKey.isBlank() && corpNum.matches("[0-9]{10}")
            && !senderId.isBlank() && smsSenderNum.matches("[0-9]{9,13}");
    }

    /** A positive provider receipt means accepted, not handset delivery. Baro handles SMS fallback. */
    public String send(String phone, Transition alert) {
        if (!ready()) throw new IllegalStateException("알림톡 및 문자 대체발송 설정이 완료되지 않았습니다.");
        String xml = request(phone, alert, ZonedDateTime.now(SEOUL));
        String response = client.post().uri(ENDPOINT).contentType(MediaType.TEXT_XML)
            .header("SOAPAction", "http://ws.baroservice.com/SendATKakaotalkEx")
            .body(xml).retrieve().body(String.class);
        String receipt = result(response);
        if (receipt == null || receipt.isBlank()) throw new IllegalArgumentException("바로빌 접수번호가 없습니다.");
        if (receipt.startsWith("-")) throw new IllegalStateException("바로빌 접수 거부 (" + receipt + ")");
        return receipt;
    }

    String request(String phone, Transition alert, ZonedDateTime now) {
        String value = value(alert.value(), alert.unit());
        String limit = alert.min() == null && alert.max() == null ? "데이터 수신 확인"
            : (alert.min() == null ? "" : "최소 " + value(alert.min(), alert.unit()))
            + (alert.min() != null && alert.max() != null ? " / " : "")
            + (alert.max() == null ? "" : "최대 " + value(alert.max(), alert.unit()));
        String message = "[펜타웍스 MRI 모니터링 알림]\n\n" + safe(alert.siteName()) + "의 " + safe(alert.siteId())
            + "에서 설정된 감시 기준을 벗어난 상태가 감지되었습니다.\n\n감지 시각: "
            + now.format(ALERT_TIME)
            + "\n감지 항목: " + safe(alert.metricLabel()) + "\n현재 값: " + value
            + "\n설정 기준: " + limit + "\n\n모니터링 화면에서 상세 상태를 확인해 주세요.";
        // 승인된 템플릿의 버튼 URL을 변경한 뒤에만 활성화해야 합니다.
        String buttonUrl = deepLinkEnabled && alert.siteId() != null && !alert.siteId().isBlank()
            ? "https://app.pentaworks.net/?scrollTo=" + URLEncoder.encode(alert.siteId().trim(), StandardCharsets.UTF_8)
            : "https://app.pentaworks.net/";
        String inner = tag("CERTKEY", certKey) + tag("CorpNum", corpNum) + tag("SenderID", senderId)
            + tag("YellowId", "@pentaworks_mri") + tag("TemplateName", "MRI 장비 상태 이상 감지 알림")
            + tag("SendDT", "") + tag("SmsReply", "A") + tag("SmsSenderNum", smsSenderNum)
            + "<KakaotalkMessage>" + tag("ReceiverName", "MRI 알림") + tag("ReceiverNum", phone)
            + tag("Title", "") + tag("Message", message) + tag("SmsMessage", sms(alert))
            + tag("SmsSubject", "") + "<Buttons><KakaotalkButton>"
            + tag("Name", "확인하기") + tag("ButtonType", "WL")
            + tag("Url1", buttonUrl) + tag("Url2", buttonUrl)
            + "</KakaotalkButton></Buttons></KakaotalkMessage>";
        return "<?xml version=\"1.0\" encoding=\"utf-8\"?>"
            + "<soap:Envelope xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\"><soap:Body>"
            + "<SendATKakaotalkEx xmlns=\"http://ws.baroservice.com/\">" + inner
            + "</SendATKakaotalkEx></soap:Body></soap:Envelope>";
    }

    static String sms(Transition alert) {
        String measured = value(alert.value(), alert.unit());
        String site = safe(alert.siteName());
        String metric = safe(alert.metricLabel());
        while (bytes(smsText(site, metric, measured)) > 90 && site.codePointCount(0, site.length()) > 1) {
            site = site.substring(0, site.offsetByCodePoints(0, site.codePointCount(0, site.length()) - 1));
        }
        while (bytes(smsText(site, metric, measured)) > 90 && metric.codePointCount(0, metric.length()) > 1) {
            metric = metric.substring(0, metric.offsetByCodePoints(0, metric.codePointCount(0, metric.length()) - 1));
        }
        return smsText(site, metric, measured);
    }

    private static String smsText(String site, String metric, String measured) {
        return "[MRI] " + site + " " + metric + " " + measured;
    }

    private static String value(Double value, String unit) {
        if (value == null || !Double.isFinite(value)) return "미수신";
        String number = java.math.BigDecimal.valueOf(value).stripTrailingZeros().toPlainString();
        if (number.length() > 24) number = Double.toString(value);
        return number
            + (unit == null ? "" : unit);
    }

    private static int bytes(String value) { return value.getBytes(StandardCharsets.UTF_8).length; }
    private static String safe(String value) { return value == null || value.isBlank() ? "미확인" : value.trim(); }
    private static String tag(String name, String value) {
        return "<" + name + ">" + value.replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace("\"", "&quot;").replace("'", "&apos;") + "</" + name + ">";
    }

    private static String result(String xml) {
        try {
            var factory = DocumentBuilderFactory.newInstance();
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
            factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
            factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
            factory.setXIncludeAware(false);
            factory.setExpandEntityReferences(false);
            Document document = factory.newDocumentBuilder().parse(new InputSource(new StringReader(xml)));
            var nodes = document.getElementsByTagNameNS("*", "SendATKakaotalkExResult");
            if (nodes.getLength() == 0) nodes = document.getElementsByTagName("SendATKakaotalkExResult");
            return nodes.getLength() == 0 ? null : nodes.item(0).getTextContent().trim();
        } catch (Exception error) {
            throw new IllegalArgumentException("바로빌 응답을 해석할 수 없습니다.", error);
        }
    }
}
