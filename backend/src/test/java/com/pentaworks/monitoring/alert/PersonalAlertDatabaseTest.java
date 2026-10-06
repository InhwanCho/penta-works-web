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
        for(String table:List.of("alert_pattern_share","user_site_alert_settings","alert_event_acknowledgement","alert_pending_state","alert_event","alert_rule","site_alert_recipient","user_site","company_site","site","app_user","company"))jdbc.execute("DROP TABLE IF EXISTS "+table);
        jdbc.execute("SET FOREIGN_KEY_CHECKS=1");
        try(var connection=ds.getConnection()) {
            ScriptUtils.executeSqlScript(connection,new ClassPathResource("personal-alert-test-schema.sql"));
            ScriptUtils.executeSqlScript(connection,new ClassPathResource("db/migration/V30__personal_alert_patterns.sql"));
        }
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
    private SiteAlertSettings save(CurrentUser actor,double max,LocalTime start,LocalTime end) {
        return personal.save(actor,"001",new AlertController.UpdateAlertThresholdsRequest(List.of(new AlertController.ThresholdUpdateRequest("hepres",0.5,max,true,false,40.0)),20,false,true,0,30,start,end,true,List.of(LocalDate.of(2026,12,25)),false,10,2));
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
        var shared=personal.share(b,"001",a.id());
        assertNull(shared.appliedAt());
        assertEquals(2.0,personal.settings(a,"001").thresholds().get(0).max());
        save(b,5.0,null,null);
        assertEquals(2.5,personal.shares(a,true).get(0).settings().thresholds().get(0).max());
        assertThrows(NotFoundException.class,()->personal.apply(b,shared.id()));
        var applied=personal.apply(a,shared.id());
        assertEquals(2.5,applied.thresholds().get(0).max());
        assertEquals(LocalTime.of(22,0),applied.quietStart());
        assertTrue(applied.suppressWeekends());
        assertEquals(List.of(LocalDate.of(2026,12,25)),applied.holidayDates());
        assertNotNull(personal.shares(a,true).get(0).appliedAt());
        assertEquals(5.0,personal.settings(b,"001").thresholds().get(0).max());
        assertEquals(List.of("01011112222"),recipients.personalPhones("001",a.id(),null));
        assertThrows(BadRequestException.class,()->personal.share(b,"001",4));
        assertThrows(BadRequestException.class,()->personal.share(b,"001",5));
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
