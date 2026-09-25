package com.pentaworks.monitoring.office;

import com.pentaworks.monitoring.config.AppProperties;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
class OfficeAssetsServiceTest {
    @Test
    void sendsApiKeyAndNormalizesNumericSiteId() throws Exception {
        var path = new AtomicReference<String>();
        var apiKey = new AtomicReference<String>();
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/", exchange -> {
            path.set(exchange.getRequestURI().getPath());
            apiKey.set(exchange.getRequestHeaders().getFirst("X-MREyes-Api-Key"));
            byte[] body = """
                {"site":{"id":1,"mreyesSiteId":"006","name":"테스트병원"},
                 "equipment":[],"components":[],"maintenanceHistory":[],
                 "generatedAt":"2026-09-25T00:00:00Z"}
                """.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();
        try {
            String baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();
            OfficeAssetsService service = new OfficeAssetsService(RestClient.builder(), properties(true, baseUrl, "service-key"));

            OfficeAssetsResponse response = service.bySite("6");

            assertEquals("006", response.site().mreyesSiteId());
            assertEquals("/api/v1/integrations/mreyes/sites/006", path.get());
            assertEquals("service-key", apiKey.get());
        } finally {
            server.stop(0);
        }
    }

    @Test
    void failsClosedWhenIntegrationIsDisabled() {
        OfficeAssetsService service = new OfficeAssetsService(RestClient.builder(), properties(false, "http://office.test", "service-key"));

        OfficeIntegrationException error = assertThrows(OfficeIntegrationException.class, () -> service.bySite("006"));

        assertEquals(503, error.status().value());
    }

    private AppProperties properties(boolean enabled, String baseUrl, String apiKey) {
        return new AppProperties(null, null, null,
            new AppProperties.OfficeIntegration(enabled, baseUrl, apiKey));
    }
}
