package com.pentaworks.monitoring.auth;
import com.pentaworks.monitoring.alert.AlertEventService;
import com.pentaworks.monitoring.admin.AuditService;
import java.util.Set;
import java.time.Instant;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
@org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable(named="MREYES_QA_DATABASE", matches="true")
class AlertHistoryMariaDbVerificationTest {
 JdbcTemplate jdbc; AlertEventService service;
 @BeforeEach void setup() {
  jdbc=new JdbcTemplate(new DriverManagerDataSource("jdbc:mariadb://127.0.0.1:13316/mreyes_auth_qa","root","local-qa-only"));
  for(String table:new String[]{"alert_event_acknowledgement","alert_event","alert_rule","site"}) jdbc.execute("DROP TABLE IF EXISTS "+table);
  jdbc.execute("CREATE TABLE site(site VARCHAR(30),name VARCHAR(100))");
  jdbc.execute("CREATE TABLE alert_rule(id BIGINT PRIMARY KEY,user_id BIGINT,metric_key VARCHAR(50))");
  jdbc.execute("CREATE TABLE alert_event_acknowledgement(event_id BIGINT,user_id BIGINT,acknowledged_at DATETIME(6),PRIMARY KEY(event_id,user_id))");
  jdbc.execute("CREATE TABLE alert_event(id BIGINT PRIMARY KEY,site_id VARCHAR(30),rule_id BIGINT,event_type VARCHAR(30),severity VARCHAR(30),measured_value DOUBLE,threshold_min DOUBLE,threshold_max DOUBLE,message VARCHAR(200),delivery_status VARCHAR(30),occurred_at DATETIME(6),recovered_at DATETIME(6),last_notified_at DATETIME(6),notification_count INT,delivery_batch_id VARCHAR(36),delivery_error VARCHAR(100))");
  jdbc.update("INSERT INTO site VALUES('001','긴 이름 서울 병원'),('002','다른 병원')");
  jdbc.update("INSERT INTO alert_rule VALUES(1,7,'hepres'),(2,8,'hepres'),(3,7,'__data__')");
  java.util.List<Object[]> samples=new java.util.ArrayList<>();
  for(int i=1;i<=620;i++) samples.add(new Object[]{i,i==1?"오래된 찾을 기록":"압력 이상",i});
  jdbc.batchUpdate("INSERT INTO alert_event(id,site_id,rule_id,event_type,severity,message,delivery_status,occurred_at,notification_count) VALUES(?,'001',1,'HIGH','WARNING',?,'SENT',DATE_ADD('2026-01-01',INTERVAL ? SECOND),1)",samples);
  jdbc.update("INSERT INTO alert_event(id,site_id,rule_id,event_type,severity,message,delivery_status,occurred_at,notification_count) VALUES(621,'002',2,'HIGH','WARNING','다른 사용자','FAILED','2026-10-01',1),(622,'002',3,'NO_DATA','WARNING','수신 중단','FAILED','2026-10-01',1)");
  jdbc.update("INSERT INTO alert_event_acknowledgement VALUES(620,7,'2026-01-02'),(619,8,'2026-01-02')");
  service=new AlertEventService(jdbc,mock(CurrentUserService.class),mock(AuditService.class));
 }
 @Test void searchesBeyond500AndPagesAllOwnedEvents() {
  var page=service.search(Set.of("001","002"),7,31,20,"","","all","all",null,null);
  assertEquals(621,page.total()); assertEquals(20,page.events().size());
  var oldest=service.search(Set.of("001"),7,1,20,"오래된","","all","all",null,null);
  assertEquals(1,oldest.total()); assertEquals(1,oldest.events().get(0).id());
 }
 @Test void respectsUserAcknowledgementAndSiteScope() {
  var page=service.search(Set.of("001"),7,1,20,"","","unacknowledged","all",null,null);
  assertEquals(619,page.total()); assertEquals(619,page.events().get(0).id());
  assertEquals(0,service.search(Set.of("001"),7,1,20,"","002","all","all",null,null).total());
 }
 @Test void filtersKindStatusAndDatesOnServer() {
  var page=service.search(Set.of("001","002"),7,1,20,"","","failed","site",Instant.parse("2026-09-01T00:00:00Z"),Instant.parse("2026-11-01T00:00:00Z"));
  assertEquals(1,page.total()); assertEquals(622,page.events().get(0).id());
  assertEquals(0,service.search(Set.of("001"),7,1,20,"%","","all","all",null,null).total());
 }
}
