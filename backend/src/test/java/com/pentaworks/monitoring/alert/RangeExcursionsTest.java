package com.pentaworks.monitoring.alert;

import com.pentaworks.monitoring.dashboard.DashboardService.MetricSample;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class RangeExcursionsTest {
    final AlertThreshold threshold=new AlertThreshold("actemp","온도","°C",15.0,25.0,true);
    MetricSample sample(int minutes,double value) {
        return new MetricSample(Instant.parse("2026-10-14T01:00:00Z").minusSeconds(minutes*60L),Map.of("actemp",value));
    }
    int count(MetricSample... samples) {return RangeExcursions.count(List.of(samples),threshold,10,"2026-10-14T01:00:00Z");}
    @Test void countsRealConsecutiveRecordsAndResetsAtNormalOrUnmeasured() {
        assertEquals(1,count(sample(0,30),sample(10,20),sample(20,30)));
        assertEquals(2,count(sample(0,30),sample(10,10),sample(20,20)));
        assertEquals(0,count(sample(0,20),sample(10,30)));
        assertEquals(1,count(sample(0,30),sample(10,0),sample(20,30)));
    }
    @Test void repeatedRecordDoesNotCountAndCollectionGapBreaksSequence() {
        assertEquals(1,count(sample(0,30),sample(0,30),sample(10,20)));
        assertEquals(1,count(sample(0,30),sample(20,30)));
        assertEquals(0,count(sample(10,30),sample(20,30)));
        assertEquals(0,count());
    }
}
