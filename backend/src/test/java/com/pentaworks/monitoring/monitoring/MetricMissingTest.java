package com.pentaworks.monitoring.monitoring;

import com.pentaworks.monitoring.dashboard.DashboardService.MetricSample;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

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
    @Test void hospitalCollectionOutageDoesNotGeneratePressureMissingEvaluation() {
        var dashboard=mock(com.pentaworks.monitoring.dashboard.DashboardService.class);
        var defaults=mock(com.pentaworks.monitoring.alert.AlertService.class);
        var events=mock(com.pentaworks.monitoring.alert.AlertEventService.class);
        var personal=mock(com.pentaworks.monitoring.alert.PersonalAlertService.class);
        var averages=mock(com.pentaworks.monitoring.alert.RollingAverageService.class);
        var user=mock(com.pentaworks.monitoring.auth.CurrentUserService.CurrentUser.class);
        when(user.id()).thenReturn(1L);
        var threshold=new com.pentaworks.monitoring.alert.AlertThreshold("hepres","He Pressure","psi",0.5,2.0,false);
        var site=new com.pentaworks.monitoring.alert.SiteAlertSettings("001","병원",true,List.of(threshold),20,true,true,0,30,null,null,false);
        var base=List.of(site);
        Map<String,Map<String,com.pentaworks.monitoring.alert.RollingAverageService.AverageState>> states=Map.of();
        when(defaults.alertSettings()).thenReturn(base);when(averages.states()).thenReturn(states);
        when(personal.activeUsers()).thenReturn(List.of(user));when(personal.settings(user,base,states)).thenReturn(base);
        var row=mock(com.pentaworks.monitoring.dashboard.DashboardResponse.DashboardRow.class);
        when(row.siteDb()).thenReturn("001");when(row.name()).thenReturn("병원");when(row.lagMin()).thenReturn(30L);
        when(row.lastAt()).thenReturn(now.toString());when(row.metrics()).thenReturn(Map.of("heleve",80.0));
        var response=mock(com.pentaworks.monitoring.dashboard.DashboardResponse.class);
        when(response.rows()).thenReturn(List.of(row));when(dashboard.getDashboard()).thenReturn(response);
        var monitor=new MonitorService(dashboard,defaults,events,mock(com.pentaworks.monitoring.alert.AlertRecipientService.class),
            mock(com.pentaworks.monitoring.alert.AlertDeliveryService.class),mock(com.pentaworks.monitoring.alert.BaroKakaoService.class),personal,averages);
        monitor.run();
        verify(events,never()).evaluateMetricMissing(anyLong(),any(),any(),anyInt());
        verify(dashboard,never()).recentMetricSamples(anyString(),anyInt());
        when(row.lagMin()).thenReturn(0L);
        when(dashboard.recentMetricSamples("001",576)).thenReturn(List.of(sample(0,null),sample(10,null),sample(20,null),sample(30,null),sample(40,null)));
        monitor.run();
        verify(events).evaluateMetricMissing(1L,site,threshold,5);
    }
    @Test void fiveReceivedRowsWithOnlyPressureMissingDoNotCountHospitalGaps() {
        var rows=List.of(sample(0,null),sample(10,null),sample(20,null),sample(30,null),sample(40,null));
        assertEquals(5,MonitorService.consecutiveMissing(rows,"hepres",10,now.toString()));
        assertEquals(0,MonitorService.consecutiveMissing(rows,"heleve",10,now.toString()));
        assertEquals(2,count(sample(0,null),sample(10,null),sample(40,null),sample(50,null),sample(60,null)));
    }
    @Test void includesUnmeasuredAndNonFiniteValuesButDoesNotCountDuplicateOrHospitalGap() {
        assertEquals(3,count(sample(0,0.0),sample(10,-1.0),sample(20,0.01),sample(30,1.0)));
        assertEquals(3,count(sample(0,Double.NaN),sample(10,Double.POSITIVE_INFINITY),sample(20,null)));
        assertEquals(2,count(sample(0,null),sample(0,null),sample(10,null),sample(40,null)));
        assertEquals(-1,MonitorService.consecutiveMissing(List.of(sample(0,null)),"hepres",10,now.minusSeconds(600).toString()));
    }
}
