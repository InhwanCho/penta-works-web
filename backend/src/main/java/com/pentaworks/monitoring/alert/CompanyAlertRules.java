package com.pentaworks.monitoring.alert;

import com.pentaworks.monitoring.dashboard.DashboardService;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.function.Predicate;

/** Shared by the monitoring worker and the dashboard. Counts actual distinct collections. */
public final class CompanyAlertRules {
    private CompanyAlertRules() {}
    public record Reading(String level, int consecutive, String message, Double average, int averageDays) {}
    public static boolean measured(Double value) {
        return value != null && Double.isFinite(value) && !DashboardService.isUnmeasured(value);
    }
    public static boolean deviates(Double value, Double average, double percent) {
        return measured(value) && average != null && Double.isFinite(average)
            && Math.abs(value - average) > Math.abs(average) * percent / 100;
    }
    public static int streak(List<DashboardService.MetricSample> samples, int interval,
                             Predicate<DashboardService.MetricSample> condition) {
        Instant previous = null;
        int count = 0;
        for (var sample : samples) {
            if (previous != null && sample.at().equals(previous)) continue;
            if (previous != null && (sample.at().isAfter(previous)
                || Duration.between(sample.at(), previous).toSeconds() > interval * 90L)) break;
            if (!condition.test(sample)) break;
            count++;
            previous = sample.at();
        }
        return count;
    }
    public static boolean chillerStopped(DashboardService.MetricSample sample) {
        Double inlet = sample.metrics().get("cctemp"), outlet = sample.metrics().get("ccflow");
        return measured(inlet) && measured(outlet) && AlertEventService.coldChillerStopped(inlet, outlet);
    }
    public static boolean chillerNormal(DashboardService.MetricSample sample) {
        return measured(sample.metrics().get("cctemp")) && measured(sample.metrics().get("ccflow")) && !chillerStopped(sample);
    }
    public static Reading reading(String key, Double value, Double average, double tolerance,
                                  Double warningMin, Double criticalMax, int highCount, int missingCount,
                                  int missingWarning, int missingCritical, boolean settling) {
        int days = "hepres".equals(key) ? 7 : 1;
        if (!measured(value)) {
            if ("hepres".equals(key) && missingCount >= missingWarning)
                return new Reading(missingCount >= missingCritical ? "RED" : "YELLOW", missingCount, "측정 누락", average, days);
            return new Reading(settling ? "YELLOW" : "NORMAL", 0, settling ? "교체 후 안정화 중" : "", average, days);
        }
        if (criticalMax != null && value > criticalMax && highCount >= 2)
            return new Reading("RED", highCount, "기준 초과", average, days);
        if (settling || criticalMax != null && value > criticalMax || warningMin != null && value >= warningMin
            || deviates(value, average, tolerance))
            return new Reading("YELLOW", highCount, settling ? "교체 후 안정화 중" : "주의", average, days);
        return new Reading("NORMAL", 0, "", average, days);
    }
}
