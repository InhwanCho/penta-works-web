package com.pentaworks.monitoring.alert;

import java.time.Instant;

public record AlertEventSummary(long id, String siteId, String siteName, String metricKey,
                                String eventType, String severity, Double measuredValue,
                                Double min, Double max, String message, String deliveryStatus,
                                Instant occurredAt, Instant acknowledgedAt, Instant recoveredAt,
                                String deliveryError, Instant lastNotifiedAt, int notificationCount) {}
