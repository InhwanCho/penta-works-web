package com.pentaworks.monitoring.alert;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pentaworks.monitoring.admin.AuditService;
import com.pentaworks.monitoring.auth.CurrentUserService;
import com.pentaworks.monitoring.auth.CurrentUserService.CurrentUser;
import com.pentaworks.monitoring.common.BadRequestException;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class PersonalAlertServiceTest {
    private final JdbcTemplate jdbc=mock(JdbcTemplate.class);
    private final CurrentUserService users=mock(CurrentUserService.class);
    private final ObjectMapper json=new ObjectMapper().findAndRegisterModules();
    private final PersonalAlertService service=spy(new PersonalAlertService(jdbc,users,mock(AlertService.class),mock(RollingAverageService.class),json,mock(AuditService.class)));
    private final CurrentUser engineer=new CurrentUser(7,1,"engineer@example.com","담당자","USER","ACTIVE");
    private SiteAlertSettings config(double tolerance) {
        AlertThreshold t=new AlertThreshold("hepres","He Pressure","psi",0.5,3.0,true,0.5,3.0,true,tolerance,null,0,0,null,false,"NO_AVERAGE",false);
        return new SiteAlertSettings("001","병원",true,List.of(t),20,true,true,0,30,null,null,false,List.of(),true,true,10,2);
    }
    @Test void twoEngineersKeepIndependentToleranceWhileUsingTheSameCurrentAverage() {
        var now=RollingAverageService.now();
        var average=new RollingAverageService.AverageState(true,40,2.0,144,0,now,now,false);
        var states=Map.of("hepres",average);
        var first=PersonalAlertService.enrich(config(10),config(40),states).thresholds().get(0);
        var second=PersonalAlertService.enrich(config(40),config(40),states).thresholds().get(0);
        assertEquals(1.8,first.effectiveMin(),1e-8);assertEquals(2.2,first.effectiveMax(),1e-8);
        assertEquals(1.2,second.effectiveMin(),1e-8);assertEquals(2.8,second.effectiveMax(),1e-8);
        assertEquals(40,average.tolerancePercent());
    }
    @Test void unusableAverageFallsBackToTheUsersOwnManualRange() {
        var threshold=PersonalAlertService.enrich(config(10),config(40),Map.of()).thresholds().get(0);
        assertFalse(threshold.averageApplied());assertEquals(0.5,threshold.effectiveMin());assertEquals(3.0,threshold.effectiveMax());
    }
    @Test void ordinaryEngineerCanSaveOnlyTheirOwnSitePattern() throws Exception {
        doReturn(config(40)).when(service).settings(engineer,"001");
        doReturn(config(40)).when(service).currentForUpdate(engineer,"001");
        var request=request(LocalTime.of(22,0),LocalTime.of(8,0));
        service.save(engineer,"001",request);
        var captor=org.mockito.ArgumentCaptor.forClass(String.class);
        verify(jdbc).update(contains("INSERT INTO user_site_alert_settings"),eq(7L),eq("001"),captor.capture());
        var stored=json.readValue(captor.getValue(),SiteAlertSettings.class);
        assertNull(stored.quietStart());assertFalse(stored.suppressWeekends());assertTrue(stored.holidayDates().isEmpty()); // a hospital save cannot overwrite delivery preferences
        assertEquals(15,stored.thresholds().get(0).tolerancePercent());
        verify(jdbc).update(contains("DELETE p FROM alert_pending_state"),eq(7L),eq("001"));
        verify(users).requireSiteAccess(engineer,"001");
    }
    @Test void incompleteQuietHoursDoNotPersistASetting() {
        doReturn(config(40)).when(service).settings(engineer,"001");
        doReturn(config(40)).when(service).currentForUpdate(engineer,"001");
        assertThrows(BadRequestException.class,()->service.save(engineer,"001",request(LocalTime.of(22,0),null)));
        verifyNoInteractions(jdbc);
    }
    private AlertController.UpdateAlertThresholdsRequest request(LocalTime start,LocalTime end) {
        return new AlertController.UpdateAlertThresholdsRequest(List.of(new AlertController.ThresholdUpdateRequest("hepres",0.5,3.0,true,true,15.0)),20,true,true,0,30,start,end,true,List.of(LocalDate.of(2026,12,25)),true,10,2);
    }
    @Test void manualThresholdValidationMatchesExistingUiRules() {
        assertDoesNotThrow(()->PersonalAlertService.validateMetric(1.0,1.0,true,40.0));
        assertThrows(BadRequestException.class,()->PersonalAlertService.validateMetric(-1.0,1.0,true,40.0));
        assertThrows(BadRequestException.class,()->PersonalAlertService.validateMetric(1.0,3.0,true,Double.NaN));
    }
    @Test void migrationKeepsBothExistingQuietWindowsAndDoesNotEnableAllDaySuppressedUsers() {
        assertArrayEquals(new LocalTime[]{LocalTime.of(21,0),LocalTime.of(9,0)},PersonalAlertService.mergeQuietWindows(LocalTime.of(22,0),LocalTime.of(8,0),new LocalTime[]{LocalTime.of(21,0),LocalTime.of(9,0)}));
        assertArrayEquals(new LocalTime[]{LocalTime.MIDNIGHT,LocalTime.MIDNIGHT},PersonalAlertService.mergeQuietWindows(LocalTime.of(22,0),LocalTime.of(8,0),new LocalTime[]{LocalTime.of(8,0),LocalTime.of(22,0)}));
    }
    @Test void commonPreferenceValidationRejectsAmbiguousTimesAndInvalidRepeatAndCanonicalizesDates() throws Exception {
        assertThrows(BadRequestException.class,()->new NotificationPreferences(1,null,null,false,List.of()));
        assertThrows(BadRequestException.class,()->new NotificationPreferences(30,LocalTime.of(22,0),null,false,List.of()));
        assertThrows(BadRequestException.class,()->new NotificationPreferences(30,LocalTime.NOON,LocalTime.NOON,false,List.of()));
        var date=LocalDate.of(2026,12,25);
        var p=new NotificationPreferences(30,LocalTime.of(22,0),LocalTime.of(8,0),true,List.of(date,date));
        assertEquals(List.of(date),p.holidayDates());
        assertEquals(p,json.readValue(json.writeValueAsString(p),NotificationPreferences.class));
        var applied=p.apply(config(40));assertEquals(config(40).thresholds(),applied.thresholds());assertEquals(config(40).triggerAfterMinutes(),applied.triggerAfterMinutes());
    }
    @Test void personalSnapshotSupportsJacksonRoundTripWithDatesAndTimes() throws Exception {
        var original=PersonalAlertService.copy(config(40),config(40).thresholds(),true,LocalTime.of(22,0),LocalTime.of(8,0));
        assertEquals(original,json.readValue(json.writeValueAsString(original),SiteAlertSettings.class));
    }
}
