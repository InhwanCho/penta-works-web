package com.pentaworks.monitoring.alert;

import com.pentaworks.monitoring.dashboard.DashboardService;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

/** Counts distinct received measurements, never repeated scheduler checks. */
public final class RangeExcursions {
    private RangeExcursions() {}
    public static boolean outside(Double value, AlertThreshold threshold) {
        return value != null && Double.isFinite(value) && !DashboardService.isUnmeasured(value)
            && ((threshold.effectiveMin()!=null && value<threshold.effectiveMin())
                || (threshold.effectiveMax()!=null && value>threshold.effectiveMax()));
    }
    public static int count(List<DashboardService.MetricSample> samples, AlertThreshold threshold,
                            int interval, String expectedLatest) {
        if(samples.isEmpty() || expectedLatest!=null && !samples.get(0).at().equals(Instant.parse(expectedLatest))) return 0;
        int count=0; Instant previous=null;
        for(var sample:samples) {
            if(previous!=null && sample.at().equals(previous)) continue;
            if(previous!=null && (sample.at().isAfter(previous)
                || Duration.between(sample.at(),previous).toSeconds()>Math.max(1,interval)*90L)) break;
            if(!outside(sample.metrics().get(threshold.key()),threshold)) break;
            count++; previous=sample.at();
        }
        return count;
    }
}
