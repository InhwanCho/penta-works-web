package com.pentaworks.monitoring.alert;

import com.pentaworks.monitoring.dashboard.DashboardResponse.DashboardRow;
import com.pentaworks.monitoring.dashboard.DashboardService.MetricSample;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class CompanyAlertRulesTest {
    private final Instant now=Instant.parse("2026-11-09T03:00:00Z");
    private final CompanyAlertPolicyService.Policy policy=CompanyAlertPolicyService.Policy.defaults();
    private MetricSample sample(int minutes,Double pressure) {
        var values=new HashMap<String,Double>();values.put("hepres",pressure);
        return new MetricSample(now.minusSeconds(minutes*60L),values);
    }
    private CompanyAlertEvaluation.State evaluate(List<MetricSample> history,int interval,Long lag,boolean enabled,LocalDate replacement) {
        var t=new AlertThreshold("hepres","헬륨 압력","psi",1.0,3.0,true,1.0,3.0,true,50,2.0,100,0,null,true,null,false,true,6);
        var site=new SiteAlertSettings("001","병원",true,List.of(t),interval*3,true,enabled,0,30,null,null,false,List.of(),true,false,interval,3);
        var row=new DashboardRow("001","1","병원",now.toString(),lag,1,1,null,null,history.get(0).metrics(),"NORMAL",0,0,List.of());
        return CompanyAlertEvaluation.evaluate(policy,site,row,history,replacement,now,lag,true);
    }
    @Test void fixedPressureBoundariesAndTwoActualHighSamples() {
        assertEquals("NORMAL",CompanyAlertRules.reading("hepres",2.29,2.0,50,2.3,2.5,0,0,3,6,false).level());
        assertEquals("YELLOW",CompanyAlertRules.reading("hepres",2.3,2.0,50,2.3,2.5,0,0,3,6,false).level());
        assertEquals("YELLOW",CompanyAlertRules.reading("hepres",2.5,2.0,50,2.3,2.5,0,0,3,6,false).level());
        assertEquals("YELLOW",evaluate(List.of(sample(0,2.6),sample(10,2.0)),10,0L,true,null).readings().get("hepres").level());
        assertEquals("RED",evaluate(List.of(sample(0,2.6),sample(10,2.7)),10,0L,true,null).readings().get("hepres").level());
    }
    @Test void averageWarningsIncludeBothDirectionsButExcludeExactFiftyPercent() {
        assertFalse(CompanyAlertRules.deviates(3.0,2.0,50));
        assertFalse(CompanyAlertRules.deviates(1.0,2.0,50));
        assertTrue(CompanyAlertRules.deviates(3.01,2.0,50));
        assertTrue(CompanyAlertRules.deviates(0.99,2.0,50));
        assertFalse(CompanyAlertRules.deviates(null,2.0,50));
        assertEquals("YELLOW",CompanyAlertRules.reading("gctemp",28.0,10.0,50,null,28.0,0,0,3,6,false).level());
        assertEquals("RED",CompanyAlertRules.reading("gctemp",28.1,20.0,50,null,28.0,2,0,3,6,false).level());
    }
    @Test void missingIsYellowAtThreeRedAtSixAndRequiresTwoValidSamplesToRearm() {
        for(int count=1;count<=7;count++) {
            var samples=new ArrayList<MetricSample>();
            for(int i=0;i<count;i++)samples.add(sample(i*10,null));
            var state=evaluate(samples,10,0L,true,null);
            assertEquals(count>=6?"RED":count>=3?"YELLOW":"NORMAL",state.readings().get("hepres").level());
            assertEquals(count>=6,state.signals().stream().filter(s->s.type().equals("METRIC_MISSING")).findFirst().orElseThrow().triggered());
        }
        var one=evaluate(List.of(sample(0,2.0),sample(10,null)),10,0L,true,null);
        var two=evaluate(List.of(sample(0,2.0),sample(10,2.0)),10,0L,true,null);
        assertFalse(one.signals().stream().filter(s->s.type().equals("METRIC_MISSING")).findFirst().orElseThrow().recovered());
        assertTrue(two.signals().stream().filter(s->s.type().equals("METRIC_MISSING")).findFirst().orElseThrow().recovered());
    }
    @Test void duplicateTimestampsAndGapsNeverInflateConsecutiveCount() {
        assertEquals(1,CompanyAlertRules.streak(List.of(sample(0,3.0),sample(0,3.0),sample(40,3.0)),10,s->true));
        assertEquals(2,CompanyAlertRules.streak(List.of(sample(0,3.0),sample(60,3.0)),60,s->true));
    }
    @Test void hourlyHospitalWarnsAtTwoHoursAndAlertsAtThreeAndSuppressesIndividualMissing() {
        var samples=List.of(sample(0,null),sample(60,null));
        assertEquals("NORMAL",evaluate(samples,60,119L,true,null).collectionLevel());
        assertEquals("YELLOW",evaluate(samples,60,120L,true,null).collectionLevel());
        var stopped=evaluate(samples,60,180L,true,null);
        assertEquals("RED",stopped.collectionLevel());assertEquals(1,stopped.signals().size());
        assertEquals("NO_DATA",stopped.signals().get(0).type());
        assertTrue(evaluate(samples,60,180L,false,null).signals().isEmpty());
    }
    @Test void replacementUsesFiveKoreanCalendarDaysAndStillShowsCriticalColor() {
        var replacement=LocalDate.of(2026,11,5);
        var state=evaluate(List.of(sample(0,3.0),sample(10,3.0)),10,0L,true,replacement);
        assertTrue(state.pressureQuiet());assertEquals("RED",state.readings().get("hepres").level());
        assertFalse(CompanyAlertPolicyService.settling(replacement,Instant.parse("2026-11-09T15:00:00Z")));
        assertEquals("YELLOW",evaluate(List.of(sample(0,2.0)),10,0L,true,replacement).readings().get("hepres").level());
    }
}
