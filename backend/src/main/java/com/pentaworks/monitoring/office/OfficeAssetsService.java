package com.pentaworks.monitoring.office;

import com.pentaworks.monitoring.config.AppProperties;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Service
public class OfficeAssetsService {
    private final RestClient client;
    private final AppProperties.OfficeIntegration config;

    public OfficeAssetsService(RestClient.Builder builder, AppProperties properties) {
        this.config = properties.officeIntegration();
        String baseUrl = config == null || config.baseUrl() == null ? "" : config.baseUrl().replaceAll("/+$", "");
        var requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(3_000);
        requestFactory.setReadTimeout(10_000);
        this.client = builder.requestFactory(requestFactory)
            .baseUrl(baseUrl.isBlank() ? "http://127.0.0.1" : baseUrl).build();
    }

    public OfficeAssetsResponse bySite(String rawSiteId) {
        requireEnabled();
        String siteId = normalizeSiteId(rawSiteId);
        try {
            OfficeAssetsResponse response = client.get()
                .uri("/api/v1/integrations/mreyes/sites/{siteId}", siteId)
                .header("X-MREyes-Api-Key", config.apiKey())
                .retrieve()
                .body(OfficeAssetsResponse.class);
            if (response == null) throw new RestClientException("Empty response");
            return response;
        } catch (HttpClientErrorException.NotFound error) {
            throw new OfficeIntegrationException(HttpStatus.NOT_FOUND, "인트라넷에 연결된 사이트 정보가 없습니다.");
        } catch (HttpClientErrorException.Unauthorized error) {
            throw new OfficeIntegrationException(HttpStatus.BAD_GATEWAY, "인트라넷 연동 인증에 실패했습니다.");
        } catch (OfficeIntegrationException error) {
            throw error;
        } catch (RestClientException error) {
            throw new OfficeIntegrationException(HttpStatus.BAD_GATEWAY, "인트라넷 정보를 불러오지 못했습니다.");
        }
    }

    public OfficePhoto photo(String rawSiteId, long maintenanceId, long photoId) {
        requireEnabled();
        String siteId = normalizeSiteId(rawSiteId);
        try {
            var response = client.get()
                .uri("/api/v1/integrations/mreyes/sites/{siteId}/maintenance/{maintenanceId}/photos/{photoId}",
                    siteId, maintenanceId, photoId)
                .header("X-MREyes-Api-Key", config.apiKey())
                .retrieve()
                .toEntity(byte[].class);
            if (response.getBody() == null) throw new RestClientException("Empty response");
            MediaType mediaType = response.getHeaders().getContentType();
            return new OfficePhoto(response.getBody(), mediaType == null ? MediaType.IMAGE_JPEG : mediaType);
        } catch (HttpClientErrorException.NotFound error) {
            throw new OfficeIntegrationException(HttpStatus.NOT_FOUND, "정비 사진을 찾을 수 없습니다.");
        } catch (HttpClientErrorException.Unauthorized error) {
            throw new OfficeIntegrationException(HttpStatus.BAD_GATEWAY, "인트라넷 연동 인증에 실패했습니다.");
        } catch (OfficeIntegrationException error) {
            throw error;
        } catch (RestClientException error) {
            throw new OfficeIntegrationException(HttpStatus.BAD_GATEWAY, "정비 사진을 불러오지 못했습니다.");
        }
    }

    private void requireEnabled() {
        if (config == null || !config.enabled()) {
            throw new OfficeIntegrationException(HttpStatus.SERVICE_UNAVAILABLE, "인트라넷 연동이 비활성화되어 있습니다.");
        }
        if (config.apiKey() == null || config.apiKey().isBlank()) {
            throw new OfficeIntegrationException(HttpStatus.SERVICE_UNAVAILABLE, "인트라넷 연동 인증정보가 설정되지 않았습니다.");
        }
    }

    private String normalizeSiteId(String siteId) {
        String value = siteId == null ? "" : siteId.trim();
        if (value.isEmpty() || value.length() > 32) {
            throw new OfficeIntegrationException(HttpStatus.BAD_REQUEST, "사이트 ID가 올바르지 않습니다.");
        }
        if (value.matches("\\d{1,3}")) return String.format("%03d", Integer.parseInt(value));
        return value;
    }

    public record OfficePhoto(byte[] data, MediaType mediaType) {}
}
