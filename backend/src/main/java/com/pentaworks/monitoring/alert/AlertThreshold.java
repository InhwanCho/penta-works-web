package com.pentaworks.monitoring.alert;

import java.time.LocalDateTime;

public record AlertThreshold(String key, String label, String unit,
                             Double min, Double max, boolean active,
                             Double effectiveMin, Double effectiveMax,
                             boolean useAverage, double tolerancePercent,
                             Double averageValue, int averageSampleCount,
                             int excludedZeroCount, LocalDateTime averageCapturedAt,
                             boolean averageApplied) {
    public AlertThreshold(String key, String label, String unit,
                          Double min, Double max, boolean active) {
        this(key, label, unit, min, max, active, min, max,
            false, 20, null, 0, 0, null, false);
    }
}
