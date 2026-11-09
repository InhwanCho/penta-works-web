package com.pentaworks.monitoring.alert;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pentaworks.monitoring.admin.AuditService;
import com.pentaworks.monitoring.auth.CurrentUserService;
import com.pentaworks.monitoring.auth.CurrentUserService.CurrentUser;
import com.pentaworks.monitoring.common.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.core.io.ClassPathResource;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@EnabledIfEnvironmentVariable(named="COMPANY_ALERT_TEST_DB_URL",matches="jdbc:mariadb://127\\.0\\.0\\.1:[0-9]+/company_alert_test")
class CompanyAlertDatabaseTest {
    JdbcTemplate db;
    CompanyAlertPolicyService policies;
    PersonalAlertService personal;
    AlertEventService events;
    org.springframework.transaction.support.TransactionTemplate transaction;
    final CurrentUser admin=new CurrentUser(3,1,"admin@example.com","관리자","ADMIN","ACTIVE");
    final CurrentUser member=new CurrentUser(1,1,"a@example.com","A","USER","ACTIVE");
    final CurrentUser other=new CurrentUser(4,2,"outside@example.com","외부","ADMIN","ACTIVE");
    SiteAlertSettings base;
    @BeforeEach void setup() throws Exception {
        var ds=new DriverManagerDataSource(System.getenv("COMPANY_ALERT_TEST_DB_URL"),"root","");
        db=new JdbcTemplate(ds);
        transaction=new org.springframework.transaction.support.TransactionTemplate(new org.springframework.jdbc.datasource.DataSourceTransactionManager(ds));
        var tables=db.queryForList("SHOW TABLES",String.class);
        try(var connection=ds.getConnection();var statement=connection.createStatement()) {
            statement.execute("SET FOREIGN_KEY_CHECKS=0");
            for(String table:tables)statement.execute("DROP TABLE `"+table+"`");
        }
        try(var c=ds.getConnection()) {
            for(String script:List.of("personal-alert-test-schema.sql","db/migration/V30__personal_alert_patterns.sql","db/migration/V35__user_notification_preferences.sql","db/migration/V62__company_alert_policy.sql"))
                ScriptUtils.executeSqlScript(c,new ClassPathResource(script));
        }
        db.execute("CREATE TABLE site_cooling_config(site_id VARCHAR(32),air_cooled BOOLEAN)");
        db.execute("CREATE TABLE workspace_record(company_id BIGINT,site_id VARCHAR(32),work_date DATE,service_type VARCHAR(30),status VARCHAR(20),deleted_at DATETIME)");
        db.execute("CREATE TABLE workspace_hospital(company_id BIGINT,site_id VARCHAR(32),monitoring_site_id VARCHAR(32))");
        db.execute("CREATE TABLE mrtb(siteid VARCHAR(32),date DATETIME,hepres_value DOUBLE,hepres_unmeasured BOOLEAN)");
        var users=new CurrentUserService(db);var audit=mock(AuditService.class);
        var mapper=new ObjectMapper().findAndRegisterModules();
        policies=new CompanyAlertPolicyService(db,mapper,users,audit);
        var defaults=mock(AlertService.class);var averages=mock(RollingAverageService.class);
        base=new SiteAlertSettings("001","테스트 병원",true,List.of(new AlertThreshold("hepres","압력","psi",0.5,2.0,true)),20,false,true,0,30,null,null,false,List.of(),true,false,10,2);
        when(defaults.alertSettings()).thenReturn(List.of(base));
        personal=new PersonalAlertService(db,users,defaults,averages,mapper,audit);personal.setCompanyPolicies(policies);
        events=new AlertEventService(db,users,audit);
    }
    @Test void sharedSettingsPreserveMemberSchedulesAndRejectForeignOrStaleWrites() {
        personal.saveNotificationPreferences(member,new NotificationPreferences(60,LocalTime.of(22,0),LocalTime.of(8,0),true,List.of()));
        var p=CompanyAlertPolicyService.Policy.defaults();
        var input=new CompanyAlertPolicyService.Policy(50,2.3,2.5,28,3,6,2,3,true,Map.of("001",new CompanyAlertPolicyService.Hospital(false,60)));
        assertThrows(ForbiddenException.class,()->policies.save(member,new CompanyAlertPolicyService.Saved(0,input)));
        assertThrows(ForbiddenException.class,()->policies.save(other,new CompanyAlertPolicyService.Saved(0,input)));
        transaction.executeWithoutResult(s->policies.save(admin,new CompanyAlertPolicyService.Saved(0,input)));
        assertThrows(ConflictException.class,()->transaction.executeWithoutResult(s->policies.save(admin,new CompanyAlertPolicyService.Saved(0,p))));
        var current=personal.settings(member,"001");
        assertFalse(current.alertsEnabled());assertEquals(60,current.collectionIntervalMinutes());
        assertEquals(180,current.noDataMinutes());assertEquals(6,current.thresholds().get(0).missingThreshold());
        assertEquals(60,current.repeatMinutes());assertTrue(current.suppressWeekends());assertEquals(LocalTime.of(22,0),current.quietStart());
        assertEquals(current.thresholds(),personal.settings(admin,"001").thresholds());
        assertTrue(policies.saved(2).policy().hospital("002").enabled());
    }
    @Test void sevenDayAverageResetsAtCompletedColdHeadReplacement() {
        var now=LocalDateTime.now(ZoneId.of("Asia/Seoul"));
        for(int i=0;i<12;i++) {
            db.update("INSERT INTO mrtb VALUES('001',?,2,FALSE)",java.sql.Timestamp.valueOf(now.minusHours(i+1)));
            db.update("INSERT INTO mrtb VALUES('001',?,8,FALSE)",java.sql.Timestamp.valueOf(now.minusDays(6).minusHours(i)));
            db.update("INSERT INTO mrtb VALUES('001',?,99,FALSE)",java.sql.Timestamp.valueOf(now.minusDays(8).minusHours(i)));
        }
        assertEquals(5,personal.settings(member,"001").thresholds().get(0).averageValue(),0.0001);
        db.update("INSERT INTO workspace_record VALUES(1,'001',?,'COLDHEAD','COMPLETED',NULL)",now.minusDays(2).toLocalDate());
        assertEquals(2,personal.settings(member,"001").thresholds().get(0).averageValue(),0.0001);
        db.update("UPDATE workspace_record SET status='IN_PROGRESS'");
        assertEquals(5,personal.settings(member,"001").thresholds().get(0).averageValue(),0.0001);
    }
    @Test void oneShotIncidentSurvivesOneGoodSampleAndRearmsAfterConfirmedRecovery() {
        var high=new CompanyAlertEvaluation.Signal("hepres","압력","HIGH","psi",2.7,2.5,true,false);
        var unconfirmed=new CompanyAlertEvaluation.Signal("hepres","압력","HIGH","psi",2.0,2.5,false,false);
        var recovered=new CompanyAlertEvaluation.Signal("hepres","압력","HIGH","psi",2.0,2.5,false,true);
        var first=transaction.execute(s->events.evaluateCompanyIncident(1,base,high));assertNotNull(first);
        events.markDelivery(List.of(first.eventId()),"SENT",null,1);
        for(int i=0;i<5;i++)assertNull(transaction.execute(s->events.evaluateCompanyIncident(1,base,high)));
        assertNull(transaction.execute(s->events.evaluateCompanyIncident(1,base,unconfirmed)));
        assertNull(transaction.execute(s->events.evaluateCompanyIncident(1,base,high)));
        transaction.executeWithoutResult(s->events.evaluateCompanyIncident(1,base,recovered));
        var next=transaction.execute(s->events.evaluateCompanyIncident(1,base,high));assertNotNull(next);assertNotEquals(first.eventId(),next.eventId());
    }
    @Test void quietPeriodSkipCanSendOnceWhenAllowedWithoutNewIncident() {
        var signal=new CompanyAlertEvaluation.Signal("hepres","압력","METRIC_MISSING","회",6.0,6.0,true,false);
        var first=transaction.execute(s->events.evaluateCompanyIncident(1,base,signal));
        events.markDelivery(List.of(first.eventId()),"SKIPPED","교체 후 안정화",0);
        var deferred=transaction.execute(s->events.evaluateCompanyIncident(1,base,signal));assertEquals(first.eventId(),deferred.eventId());
        events.markDelivery(List.of(first.eventId()),"SENT",null,1);
        assertNull(transaction.execute(s->events.evaluateCompanyIncident(1,base,signal)));
    }
}
