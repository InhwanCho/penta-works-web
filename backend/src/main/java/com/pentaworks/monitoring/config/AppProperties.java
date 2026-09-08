package com.pentaworks.monitoring.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public record AppProperties(Cors cors, Jwt jwt, Monitor monitor) {
    public record Cors(String allowedOrigins) {}
    public record Jwt(String secret, long expirationMinutes) {}
    public record Monitor(String cronSecret, String slackWebhookUrl) {}
}
