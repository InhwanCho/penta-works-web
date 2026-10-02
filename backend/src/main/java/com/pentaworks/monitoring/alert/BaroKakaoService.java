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
import org.w3c.dom.Node;
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

    /** The provider reports Kakao status and the SMS fallback state separately. */
    public ProviderStatus lookup(String receipt) {
        if (!ready()) throw new IllegalStateException("바로빌 조회 설정이 완료되지 않았습니다.");
        if (receipt == null || receipt.isBlank() || receipt.length() > 50)
            throw new IllegalArgumentException("바로빌 접수번호 형식이 올바르지 않습니다.");
        String body = tag("CERTKEY", certKey) + tag("CorpNum", corpNum) + tag("SendKey", receipt);
        String xml = "<?xml version=\"1.0\" encoding=\"utf-8\"?>"
            + "<soap:Envelope xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\"><soap:Body>"
            + "<GetSendKakaotalkEx xmlns=\"http://ws.baroservice.com/\">" + body
            + "</GetSendKakaotalkEx></soap:Body></soap:Envelope>";
        String response = client.post().uri(ENDPOINT).contentType(MediaType.TEXT_XML)
            .header("SOAPAction", "http://ws.baroservice.com/GetSendKakaotalkEx")
            .body(xml).retrieve().body(String.class);
        return parseStatus(response);
    }

    String request(String phone, Transition alert, ZonedDateTime now) {
        // Approved template BB0836851023705085; this API identifies it by TemplateName.
        String value = value(alert.value(), alert.unit());
        String message = "[MrEyes MRI 모니터링 알림]\n담당자님, 설정 범위 이탈이 감지되었습니다.\n\n병원명: "
            + safe(alert.siteName()) + "\n감지 시각: " + now.format(ALERT_TIME)
            + "\n감지 항목: " + safe(alert.metricLabel()) + "\n현재 값: " + value;
        String buttonUrl = "https://app.pentaworks.net/?scrollTo="
            + URLEncoder.encode(safe(alert.siteId()), StandardCharsets.UTF_8);
        String inner = tag("CERTKEY", certKey) + tag("CorpNum", corpNum) + tag("SenderID", senderId)
            + tag("YellowId", "@pentaworks_mri") + tag("TemplateName", "MRI 장비 상태 이상 감지 알림 - 간소화")
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
        Node node = responseNode(xml, "SendATKakaotalkExResult");
        return node == null ? null : node.getTextContent().trim();
    }

    static ProviderStatus parseStatus(String xml) {
        Node node = responseNode(xml, "GetSendKakaotalkExResult");
        if (node == null) throw new IllegalArgumentException("바로빌 상태 조회 결과가 없습니다.");
        int sendStatus = number(child(node, "SendStatus"));
        int resultCode = number(child(node, "ResultCode"));
        return new ProviderStatus(sendStatus, resultCode,
            child(node, "ResultMessage"), child(node, "SmsSendState"));
    }

    private static int number(String value) {
        try { return Integer.parseInt(value); }
        catch (NumberFormatException error) { throw new IllegalArgumentException("바로빌 상태 코드가 올바르지 않습니다.", error); }
    }

    private static String child(Node parent, String name) {
        for (Node node = parent.getFirstChild(); node != null; node = node.getNextSibling())
            if (name.equals(node.getLocalName()) || name.equals(node.getNodeName()))
                return node.getTextContent().trim();
        return null;
    }

    private static Node responseNode(String xml, String name) {
        try {
            var factory = DocumentBuilderFactory.newInstance();
            factory.setNamespaceAware(true);
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
            factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
            factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
            factory.setXIncludeAware(false);
            factory.setExpandEntityReferences(false);
            Document document = factory.newDocumentBuilder().parse(new InputSource(new StringReader(xml)));
            var nodes = document.getElementsByTagNameNS("*", name);
            if (nodes.getLength() == 0) nodes = document.getElementsByTagName(name);
            return nodes.getLength() == 0 ? null : nodes.item(0);
        } catch (Exception error) {
            throw new IllegalArgumentException("바로빌 응답을 해석할 수 없습니다.", error);
        }
    }

    public record ProviderStatus(int sendStatus, int resultCode, String resultMessage, String smsSendState) {}
}
