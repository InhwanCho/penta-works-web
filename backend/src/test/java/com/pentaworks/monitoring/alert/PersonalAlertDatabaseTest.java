package com.pentaworks.monitoring.alert;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pentaworks.monitoring.admin.AuditService;
import com.pentaworks.monitoring.auth.CurrentUserService;
import com.pentaworks.monitoring.auth.CurrentUserService.CurrentUser;
import com.pentaworks.monitoring.common.BadRequestException;
import com.pentaworks.monitoring.common.NotFoundException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.core.io.ClassPathResource;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Opt-in, disposable local database only. Never connects to an application database. */
@EnabledIfEnvironmentVariable(named="PERSONAL_ALERT_TEST_DB_URL",matches="jdbc:mariadb://127\\.0\\.0\\.1:[0-9]+/personal_alert_test")
class PersonalAlertDatabaseTest {
    private JdbcTemplate jdbc;
    private org.springframework.transaction.support.TransactionTemplate transaction;
    private PersonalAlertService personal;
    private AlertEventService events;
    private AlertRecipientService recipients;
    private final CurrentUser a=new CurrentUser(1,1,"a@example.com","엔지니어 A","USER","ACTIVE");
    private final CurrentUser b=new CurrentUser(2,1,"b@example.com","엔지니어 B","USER","ACTIVE");
    private SiteAlertSettings base;
    @BeforeEach void setup() throws Exception {
        var ds=new DriverManagerDataSource(System.getenv("PERSONAL_ALERT_TEST_DB_URL"),"root","");
        jdbc=new JdbcTemplate(ds);
        transaction=new org.springframework.transaction.support.TransactionTemplate(new org.springframework.jdbc.datasource.DataSourceTransactionManager(ds));
        jdbc.execute("SET FOREIGN_KEY_CHECKS=0");
        for(String table:List.of("user_notification_preferences","user_dashboard_hidden_site","mrtb","alert_pattern_share","user_site_alert_settings","alert_event_acknowledgement","alert_pending_state","alert_event","alert_rule","site_alert_recipient","user_site","company_site","site","app_user","company"))jdbc.execute("DROP TABLE IF EXISTS "+table);
        jdbc.execute("SET FOREIGN_KEY_CHECKS=1");
        try(var connection=ds.getConnection()) {
            ScriptUtils.executeSqlScript(connection,new ClassPathResource("personal-alert-test-schema.sql"));
            ScriptUtils.executeSqlScript(connection,new ClassPathResource("db/migration/V30__personal_alert_patterns.sql"));
            ScriptUtils.executeSqlScript(connection,new ClassPathResource("db/migration/V35__user_notification_preferences.sql"));
        }
        jdbc.execute("ALTER TABLE app_user ADD COLUMN phone VARCHAR(30)");
        jdbc.execute("CREATE TABLE user_dashboard_hidden_site(user_id BIGINT UNSIGNED,site_id VARCHAR(32),PRIMARY KEY(user_id,site_id))");
        jdbc.update("UPDATE app_user SET phone=CASE id WHEN 1 THEN '01011112222' WHEN 2 THEN '01033334444' ELSE '01055556666' END");
        var users=new CurrentUserService(jdbc);
        var audit=mock(AuditService.class);
        var defaults=mock(AlertService.class);
        var averages=mock(RollingAverageService.class);
        base=new SiteAlertSettings("001","테스트 병원",true,List.of(new AlertThreshold("hepres","He Pressure","psi",0.5,2.0,true)),20,false,true,0,30,null,null,false,List.of(),true,false,10,2);
        when(defaults.alertSettings()).thenReturn(List.of(base));
        personal=new PersonalAlertService(jdbc,users,defaults,averages,new ObjectMapper().findAndRegisterModules(),audit);
        events=new AlertEventService(jdbc,users,audit);
        recipients=new AlertRecipientService(jdbc,users,audit);
    }
    @Test void commonPreferencesApplyToAllAssignedAndFutureHospitalsAndOnlyTheirOwner() {
        transaction.executeWithoutResult(status->{
            var quiet=new NotificationPreferences(60,LocalTime.of(18,0),LocalTime.of(9,0),true,List.of(LocalDate.of(2026,12,25)));
            personal.saveNotificationPreferences(a,quiet);
            var first=personal.settings(a,"001");
            assertEquals(60,first.repeatMinutes());assertEquals(LocalTime.of(18,0),first.quietStart());
            assertEquals(30,personal.settings(b,"001").repeatMinutes());
            var second=new SiteAlertSettings("002","새 병원",true,base.thresholds(),20,false,true,10,5,null,null,false,List.of(),true,true,10,2);
            jdbc.update("INSERT INTO company_site VALUES(1,'002',TRUE)");
            jdbc.update("INSERT INTO user_site VALUES(1,'002')");
            var both=personal.settings(a,List.of(base,second),Map.of());
            assertEquals(2,both.size());
            assertTrue(both.stream().allMatch(v->v.repeatMinutes()==60&&v.quietStart().equals(LocalTime.of(18,0))&&v.suppressWeekends()));
            assertEquals(10,both.get(1).triggerAfterMinutes());
            personal.reset(a,"001");assertEquals(quiet,personal.notificationPreferences(a).preferences());
        });
    }
    @Test void conflictingLegacyPreferencesRequireAnExplicitChoiceWithoutChangingEither() throws Exception {
        var mapper=new ObjectMapper().findAndRegisterModules();
        jdbc.update("INSERT INTO company_site VALUES(1,'002',TRUE)");jdbc.update("INSERT INTO user_site VALUES(1,'002')");
        var second=new SiteAlertSettings("002","다른 병원",true,base.thresholds(),20,false,true,10,60,LocalTime.of(22,0),LocalTime.of(8,0),true,List.of(),true,true,10,2);
        jdbc.update("INSERT INTO user_site_alert_settings(user_id,site_id,settings_json) VALUES(1,'001',?),(1,'002',?)",mapper.writeValueAsString(base),mapper.writeValueAsString(second));
        var defaults=mock(AlertService.class);when(defaults.alertSettings()).thenReturn(List.of(base,second));
        var service=new PersonalAlertService(jdbc,new CurrentUserService(jdbc),defaults,mock(RollingAverageService.class),mapper,mock(AuditService.class));
        var view=service.notificationPreferences(a);assertTrue(view.needsSelection());assertNull(view.preferences());assertEquals(2,view.previousSettings().size());
        assertEquals(30,service.settings(a,"001").repeatMinutes());assertEquals(60,service.settings(a,"002").repeatMinutes());
        service.saveNotificationPreferences(a,NotificationPreferences.from(second));
        assertFalse(service.notificationPreferences(a).needsSelection());assertEquals(60,service.settings(a,"001").repeatMinutes());
    }

    @Test void dashboardRecipientsFollowAccountPhoneVisibilityAndAccessWithoutManualRegistration() {
        jdbc.update("DELETE FROM site_alert_recipient");
        assertEquals(List.of("01011112222"),recipients.personalPhones("001",1,null));
        assertEquals(List.of("01055556666"),recipients.personalPhones("001",3,null)); // admin, no user_site row
        assertTrue(recipients.personalPhones("001",4,null).isEmpty()); // other company
        assertTrue(recipients.personalPhones("001",5,null).isEmpty()); // no assignment
        jdbc.update("UPDATE app_user SET phone='010-9999-8888' WHERE id=1");
        assertEquals(List.of("01099998888"),recipients.personalPhones("001",1,null));
        jdbc.update("INSERT INTO user_dashboard_hidden_site VALUES(1,'001')");
        assertTrue(recipients.personalPhones("001",1,null).isEmpty());
        assertEquals(List.of("01033334444"),recipients.personalPhones("001",2,null));
        jdbc.update("DELETE FROM user_dashboard_hidden_site WHERE user_id=1");
        assertEquals(List.of("01099998888"),recipients.personalPhones("001",1,null));
        jdbc.update("DELETE FROM user_site WHERE user_id=1");
        assertTrue(recipients.personalPhones("001",1,null).isEmpty());
        jdbc.update("INSERT INTO user_site VALUES(1,'001')");
        for(String phone:List.of("", "invalid")) {
            jdbc.update("UPDATE app_user SET phone=? WHERE id=1",phone);
            assertTrue(recipients.personalPhones("001",1,null).isEmpty());
        }
        jdbc.update("UPDATE app_user SET phone=NULL WHERE id=1");
        assertTrue(recipients.personalPhones("001",1,null).isEmpty());
        jdbc.update("UPDATE app_user SET phone='01011112222',status='DISABLED' WHERE id=1");
        assertTrue(recipients.personalPhones("001",1,null).isEmpty());
        jdbc.update("UPDATE app_user SET status='ACTIVE' WHERE id=1");
        jdbc.update("UPDATE company_site SET is_dashboard_visible=FALSE WHERE company_id=1");
        assertTrue(recipients.personalPhones("001",1,null).isEmpty());
        jdbc.update("UPDATE company_site SET is_dashboard_visible=TRUE WHERE company_id=1");
        jdbc.update("UPDATE company SET status='DISABLED' WHERE id=1");
        assertTrue(recipients.personalPhones("001",1,null).isEmpty());
    }

    private SiteAlertSettings save(CurrentUser actor,double max,LocalTime start,LocalTime end) {
        return personal.save(actor,"001",new AlertController.UpdateAlertThresholdsRequest(List.of(new AlertController.ThresholdUpdateRequest("hepres",0.5,max,true,false,40.0)),20,false,true,0,30,start,end,true,List.of(LocalDate.of(2026,12,25)),false,10,2));
    }
    @Test void recentMetricQueryReadsLatestRealRowsAndNormalizesMissingValues() {
        var keys=List.of("recosi","coldtp","recoru","hepres","heleve","actemp","achumi","gctemp","gcflow","cctemp","ccflow");
        jdbc.execute("CREATE TABLE mrtb (`index` BIGINT PRIMARY KEY,siteid VARCHAR(20),date DATETIME,"+keys.stream().map(k->k+"_value VARCHAR(50)").collect(java.util.stream.Collectors.joining(","))+")");
        jdbc.update("INSERT INTO mrtb (`index`,siteid,date,hepres_value,heleve_value) VALUES(1,'001','2026-10-07 02:40:00','1.2','80'),(2,'001','2026-10-07 02:50:00','0.001','80'),(3,'001','2026-10-07 03:00:00',NULL,'80'),(4,'002','2026-10-07 03:00:00','3','90')");
        var samples=new com.pentaworks.monitoring.dashboard.DashboardService(jdbc,mock(RollingAverageService.class)).recentMetricSamples("001",3);
        assertEquals(3,samples.size());assertNull(samples.get(0).metrics().get("hepres"));assertNull(samples.get(1).metrics().get("hepres"));
        assertEquals(1.2,samples.get(2).metrics().get("hepres"));assertEquals(80.0,samples.get(0).metrics().get("heleve"));
        assertTrue(samples.get(0).at().isAfter(samples.get(1).at()));
    }
    @Test void missingMetricSettingsPersistAndOperateIndependentlyOfRangeAndOtherUsers() {
        transaction.executeWithoutResult(status->{
            var request=new AlertController.UpdateAlertThresholdsRequest(List.of(new AlertController.ThresholdUpdateRequest("hepres",0.5,2.0,false,false,40.0,true,3)),20,false,true,0,0,null,null,false,List.of(),false,10,2);
            var first=personal.save(a,"001",request);
            assertTrue(first.thresholds().get(0).missingActive());assertEquals(3,first.thresholds().get(0).missingThreshold());
            assertTrue(personal.settings(b,"001").thresholds().get(0).missingActive());
            assertEquals(5,personal.settings(b,"001").thresholds().get(0).missingThreshold());
            assertNull(events.evaluateMetricMissing(a.id(),first,first.thresholds().get(0),2));
            var event=events.evaluateMetricMissing(a.id(),first,first.thresholds().get(0),3);
            assertNotNull(event);assertEquals("METRIC_MISSING",events.events(Set.of("001"),500,a.id()).get(0).eventType());
            assertTrue(events.events(Set.of("001"),500,b.id()).isEmpty());
            personal.save(a,"001",request); // Saving disabled range must not close the enabled missing incident.
            assertNull(events.events(Set.of("001"),500,a.id()).get(0).recoveredAt());
            events.evaluateMetricMissing(a.id(),first,first.thresholds().get(0),0);
            assertNotNull(events.events(Set.of("001"),500,a.id()).get(0).recoveredAt());
            var again=events.evaluateMetricMissing(a.id(),first,first.thresholds().get(0),3);
            assertNotEquals(event.eventId(),again.eventId());
            personal.metric(a,"001","hepres",new AlertController.ThresholdRequest(0.5,2.0,false,false,40.0,false,3));
            assertTrue(events.events(Set.of("001"),500,a.id()).stream().allMatch(e->e.recoveredAt()!=null));
        });
    }
    @Test void mysqlMigrationAndPersonalEventsAreIsolatedForEngineersAndAdministrators() {
        transaction.executeWithoutResult(status->{
        var first=save(a,4.0,null,null);
        var second=personal.settings(b,"001");
        assertNull(events.evaluate(a.id(),first,first.thresholds().get(0),3.0));
        var event=events.evaluate(b.id(),second,second.thresholds().get(0),3.0);
        assertNotNull(event);
        assertEquals(0,events.events(Set.of("001"),500,a.id()).size());
        assertEquals(1,events.events(Set.of("001"),500,b.id()).size());
        assertThrows(NotFoundException.class,()->events.acknowledge(a,event.eventId()));
        var admin=new CurrentUser(3,1,"admin@example.com","관리자","ADMIN","ACTIVE");
        assertThrows(NotFoundException.class,()->events.requireEventAccess(event.eventId(),admin));
        assertEquals(List.of("01033334444"),recipients.personalPhones("001",b.id(),event.eventId()));
        assertNotNull(events.acknowledge(b,event.eventId()).acknowledgedAt());
        assertEquals(List.of(),recipients.personalPhones("001",b.id(),event.eventId()));
        assertEquals(4.0,personal.settings(a,"001").thresholds().get(0).max());
        });
    }
    @Test void sharingSnapshotsNeedsRecipientApplyAndCannotCrossCompanyOrSiteAccess() {
        transaction.executeWithoutResult(status->{
        save(b,2.5,LocalTime.of(22,0),LocalTime.of(8,0));
        personal.saveNotificationPreferences(b,new NotificationPreferences(60,LocalTime.of(22,0),LocalTime.of(8,0),true,List.of(LocalDate.of(2026,12,25))));
        var shared=personal.share(b,"001",a.id());
        assertNull(shared.appliedAt());
        assertEquals(2.0,personal.settings(a,"001").thresholds().get(0).max());
        save(b,5.0,null,null);
        assertEquals(2.5,personal.shares(a,true).get(0).settings().thresholds().get(0).max());
        assertThrows(NotFoundException.class,()->personal.apply(b,shared.id()));
        var applied=personal.apply(a,shared.id());
        assertEquals(2.5,applied.thresholds().get(0).max());
        assertNull(applied.quietStart());
        assertFalse(applied.suppressWeekends());
        assertTrue(applied.holidayDates().isEmpty());
        assertEquals(30,applied.repeatMinutes()); // receiving a pattern preserves my common delivery settings
        assertNotNull(personal.shares(a,true).get(0).appliedAt());
        assertEquals(5.0,personal.settings(b,"001").thresholds().get(0).max());
        assertEquals(List.of("01011112222"),recipients.personalPhones("001",a.id(),null));
        assertThrows(BadRequestException.class,()->personal.share(b,"001",4));
        assertThrows(BadRequestException.class,()->personal.share(b,"001",5));
        });
    }
    @Test void historyKeepsOwnEventsWithoutRecipientsAndExcludesOtherOwners() {
        transaction.executeWithoutResult(status->{
            var first=personal.settings(a,"001");
            var second=personal.settings(b,"001");
            var mine=events.evaluate(a.id(),first,first.thresholds().get(0),3.0);
            var theirs=events.evaluate(b.id(),second,second.thresholds().get(0),3.0);
            var shared=events.evaluate(0,first,first.thresholds().get(0),3.0);
            assertEquals(List.of(mine.eventId()),events.events(Set.of("001"),500,a.id()).stream().map(AlertEventSummary::id).toList());
            assertEquals(List.of(theirs.eventId()),events.events(Set.of("001"),500,b.id()).stream().map(AlertEventSummary::id).toList());
            assertThrows(NotFoundException.class,()->events.acknowledge(a,shared.eventId()));
            assertThrows(NotFoundException.class,()->events.retryTransition(a,theirs.eventId()));
            assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM alert_event_acknowledgement",Integer.class));

            var admin=new CurrentUser(3,1,"admin@example.com","관리자","ADMIN","ACTIVE");
            var ownAdminEvent=events.evaluate(admin.id(),first,first.thresholds().get(0),3.0);
            assertEquals(List.of(ownAdminEvent.eventId()),events.events(Set.of("001"),500,admin.id()).stream().map(AlertEventSummary::id).toList());
            assertDoesNotThrow(()->events.requireEventAccess(ownAdminEvent.eventId(),admin));
            assertThrows(NotFoundException.class,()->events.requireEventAccess(mine.eventId(),admin));
            jdbc.update("INSERT INTO site_alert_recipient(site_id,user_id,channel,destination,priority,is_enabled) VALUES('001',3,'KAKAO_ALIMTALK','01055556666',0,TRUE)");
            assertEquals(List.of(ownAdminEvent.eventId()),events.events(Set.of("001"),500,admin.id()).stream().map(AlertEventSummary::id).toList());
            jdbc.update("DELETE FROM site_alert_recipient WHERE user_id=1");
            events.markDelivery(List.of(mine.eventId()),"SKIPPED","등록된 수신 채널이 없습니다.",0);
            var history=events.events(Set.of("001"),500,a.id());
            assertEquals(List.of(mine.eventId()),history.stream().map(AlertEventSummary::id).toList());
            assertEquals("SKIPPED",history.get(0).deliveryStatus());
            assertEquals("등록된 수신 채널이 없습니다.",history.get(0).deliveryError());
            assertDoesNotThrow(()->events.acknowledge(a,mine.eventId()));
            assertTrue(events.events(Set.of(),500,a.id()).isEmpty());
            assertEquals(1,events.events(Set.of("001"),500,b.id()).size());
        });
    }
    @Test void initialSnapshotMovesLegacyWindowsAndDisabledSwitchWithoutDeletingHistory() {
        transaction.executeWithoutResult(status->{
            jdbc.update("UPDATE site_alert_recipient SET quiet_start='22:00',quiet_end='08:00' WHERE user_id=1");
            jdbc.update("UPDATE site_alert_recipient SET is_enabled=FALSE WHERE user_id=2");
            var first=personal.settings(a,"001");var second=personal.settings(b,"001");
            assertEquals(LocalTime.of(22,0),first.quietStart());assertEquals(LocalTime.of(8,0),first.quietEnd());
            assertTrue(first.alertsEnabled());assertFalse(second.alertsEnabled());
            assertTrue(jdbc.queryForObject("SELECT is_enabled FROM site_alert_recipient WHERE user_id=2",Boolean.class));
            assertFalse(personal.settings(b,"001").alertsEnabled());
            assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM alert_event WHERE id=99 AND recovered_at IS NOT NULL AND notification_count=2",Integer.class));
            assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM alert_event_acknowledgement WHERE event_id=99",Integer.class));
        });
    }

    @Test void changingQuietHoursKeepsIncidentWhileDisablingPersonalAlertClosesOnlyThatOwner() {
        transaction.executeWithoutResult(status->{
        var first=personal.settings(a,"001");var second=personal.settings(b,"001");
        var ea=events.evaluate(a.id(),first,first.thresholds().get(0),3.0);
        var eb=events.evaluate(b.id(),second,second.thresholds().get(0),3.0);
        save(a,2.0,LocalTime.of(22,0),LocalTime.of(8,0));
        assertNull(events.events(Set.of("001"),500,a.id()).get(0).recoveredAt());
        personal.enabled(a,"001",false);
        assertNotNull(events.events(Set.of("001"),500,a.id()).get(0).recoveredAt());
        assertNull(events.events(Set.of("001"),500,b.id()).get(0).recoveredAt());
        assertNull(events.events(Set.of("001"),500,a.id()).get(0).acknowledgedAt());
        });
    }
}
