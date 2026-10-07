package com.pentaworks.monitoring.alert;

import java.time.LocalDateTime;

public record AlertThreshold(String key, String label, String unit,
                             Double min, Double max, boolean active,
                             Double effectiveMin, Double effectiveMax,
                             boolean useAverage, double tolerancePercent,
                             Double averageValue, int averageSampleCount,
                             int excludedZeroCount, LocalDateTime averageCapturedAt,
                             boolean averageApplied, String averageUnavailableReason, boolean historicalAverage, boolean missingActive, int missingThreshold) {
    public AlertThreshold { if (missingThreshold == 0) missingThreshold = 3; }
    public AlertThreshold(String key, String label, String unit, Double min, Double max, boolean active,
        Double effectiveMin, Double effectiveMax, boolean useAverage, double tolerancePercent,
        Double averageValue, int averageSampleCount, int excludedZeroCount, LocalDateTime averageCapturedAt,
        boolean averageApplied, String averageUnavailableReason, boolean historicalAverage) {
        this(key,label,unit,min,max,active,effectiveMin,effectiveMax,useAverage,tolerancePercent,averageValue,averageSampleCount,excludedZeroCount,averageCapturedAt,averageApplied,averageUnavailableReason,historicalAverage,false,3);
    }
    public AlertThreshold(String key, String label, String unit,
                          Double min, Double max, boolean active) {
        this(key, label, unit, min, max, active, min, max,
            false, RollingAverageService.DEFAULT_TOLERANCE_PERCENT, null, 0, 0, null, false, "NO_AVERAGE", false);
    }
}
