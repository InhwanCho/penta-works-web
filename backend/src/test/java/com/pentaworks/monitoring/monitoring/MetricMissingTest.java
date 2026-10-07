package com.pentaworks.monitoring.monitoring;

import com.pentaworks.monitoring.dashboard.DashboardService.MetricSample;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class MetricMissingTest {
    private final Instant now=Instant.parse("2026-10-07T03:00:00Z");
    private MetricSample sample(int minutes,Double value) {
        Map<String,Double> values=new HashMap<>();values.put("hepres",value);values.put("heleve",80.0);
        return new MetricSample(now.minusSeconds(minutes*60L),values);
    }
    private int count(MetricSample... samples) {return MonitorService.consecutiveMissing(List.of(samples),"hepres",10,now.toString());}
    @Test void countsActualCollectionsAndResetsAtFirstValidMeasurement() {
        assertEquals(1,count(sample(0,null)));
        assertEquals(2,count(sample(0,null),sample(10,null)));
        assertEquals(3,count(sample(0,null),sample(10,null),sample(20,null),sample(30,1.2),sample(40,null)));
        assertEquals(0,count(sample(0,1.2),sample(10,null),sample(20,null)));
        var records=List.of(sample(0,null),sample(10,null),sample(20,null));
        assertEquals(3,MonitorService.consecutiveMissing(records,"hepres",10,now.toString()));
        assertEquals(3,MonitorService.consecutiveMissing(records,"hepres",10,now.toString()));
        assertEquals(0,MonitorService.consecutiveMissing(records,"heleve",10,now.toString()));
    }
    @Test void includesUnmeasuredAndNonFiniteValuesButDoesNotCountDuplicateOrHospitalGap() {
        assertEquals(3,count(sample(0,0.0),sample(10,-1.0),sample(20,0.01),sample(30,1.0)));
        assertEquals(3,count(sample(0,Double.NaN),sample(10,Double.POSITIVE_INFINITY),sample(20,null)));
        assertEquals(2,count(sample(0,null),sample(0,null),sample(10,null),sample(40,null)));
        assertEquals(-1,MonitorService.consecutiveMissing(List.of(sample(0,null)),"hepres",10,now.minusSeconds(600).toString()));
    }
}
