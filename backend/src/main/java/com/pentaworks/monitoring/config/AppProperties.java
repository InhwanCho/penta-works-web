package com.pentaworks.monitoring.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public record AppProperties(Cors cors, Jwt jwt, Monitor monitor, OfficeIntegration officeIntegration) {
    public record Cors(String allowedOrigins) {}
    public record Jwt(String secret, long accessExpirationMinutes, long refreshExpirationDays, boolean secureCookie) {}
    public record Monitor(String cronSecret) {}
    public record OfficeIntegration(boolean enabled, String baseUrl, String apiKey) {}
}
