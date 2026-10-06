package com.pentaworks.monitoring.alert;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pentaworks.monitoring.admin.AuditService;
import com.pentaworks.monitoring.auth.CurrentUserService;
import com.pentaworks.monitoring.auth.CurrentUserService.CurrentUser;
import com.pentaworks.monitoring.common.BadRequestException;
import com.pentaworks.monitoring.common.NotFoundException;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;
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
        assertEquals(LocalTime.of(22,0),stored.quietStart());assertTrue(stored.suppressWeekends());assertEquals(request.holidayDates(),stored.holidayDates());
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
    @Test void sharingTargetsIncludeOtherEngineersButExcludeOtherCompaniesAndInaccessibleSites() {
        var peer=new CurrentUser(8,1,"peer@example.com","동료","USER","ACTIVE");
        var outsider=new CurrentUser(9,2,"outside@example.com","외부","USER","ACTIVE");
        var restricted=new CurrentUser(10,1,"restricted@example.com","권한 없음","USER","ACTIVE");
        doReturn(List.of(engineer,peer,outsider,restricted)).when(service).activeUsers();
        when(users.allowedSiteIds(peer)).thenReturn(Set.of("001"));when(users.allowedSiteIds(restricted)).thenReturn(Set.of("002"));
        assertEquals(List.of(new PersonalAlertService.ShareTarget(8,"동료")),service.targets(engineer,"001"));
    }
    @Test void cannotSendASnapshotToAnUnauthorizedUser() {
        doReturn(List.of()).when(service).targets(engineer,"001");
        assertThrows(BadRequestException.class,()->service.share(engineer,"001",9));verifyNoInteractions(jdbc);
    }
    @Test void cannotApplyAShareAddressedToSomeoneElse() {
        assertThrows(NotFoundException.class,()->service.apply(engineer,99));
        verify(jdbc,never()).update(anyString(),any(Object[].class));
    }
    @Test @SuppressWarnings("unchecked") void applyingShareCopiesPreferencesToRecipientAndDoesNotCopyPhones() throws Exception {
        String snapshot=json.writeValueAsString(config(15));
        when(jdbc.query(anyString(),any(ResultSetExtractor.class),eq(99L),eq(7L),eq(1L))).thenReturn(snapshot);
        doReturn(config(15)).when(service).settings(engineer,"001");
        doReturn(config(15)).when(service).currentForUpdate(engineer,"001");
        service.apply(engineer,99);
        verify(jdbc).update(contains("INSERT INTO user_site_alert_settings"),eq(7L),eq("001"),eq(snapshot));
        verify(jdbc).update(eq("UPDATE alert_pattern_share SET applied_at=CURRENT_TIMESTAMP(6) WHERE id=?"),eq(99L));
        verify(jdbc,never()).update(contains("site_alert_recipient"),any(Object[].class));
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
    @Test void personalSnapshotSupportsJacksonRoundTripWithDatesAndTimes() throws Exception {
        var original=PersonalAlertService.copy(config(40),config(40).thresholds(),true,LocalTime.of(22,0),LocalTime.of(8,0));
        assertEquals(original,json.readValue(json.writeValueAsString(original),SiteAlertSettings.class));
    }
}
