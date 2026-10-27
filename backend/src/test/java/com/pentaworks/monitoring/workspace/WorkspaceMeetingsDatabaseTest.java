package com.pentaworks.monitoring.workspace;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Objects;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.security.core.Authentication;
import com.pentaworks.monitoring.admin.AuditService;
import com.pentaworks.monitoring.auth.CurrentUserService;
import com.pentaworks.monitoring.common.*;

@EnabledIfEnvironmentVariable(named="MEETINGS_TEST_DB_URL",matches="jdbc:mariadb://127\\.0\\.0\\.1:13369/mreyes_meetings_qa")
class WorkspaceMeetingsDatabaseTest {
 JdbcTemplate db;WorkspaceMeetings controller;CurrentUserService users;Authentication auth;
 @BeforeEach void setup() throws Exception {
  db=new JdbcTemplate(new DriverManagerDataSource(System.getenv("MEETINGS_TEST_DB_URL"),"mreyes_meetings_qa",System.getenv("MEETINGS_TEST_DB_PASSWORD")));
  db.execute("DROP TABLE IF EXISTS workspace_meeting");db.execute("DROP TABLE IF EXISTS company");
  db.execute("CREATE TABLE company(id BIGINT PRIMARY KEY,code VARCHAR(100),status VARCHAR(20))");
  db.execute("INSERT INTO company VALUES(1,'PENTAWORKS','ACTIVE'),(2,'OTHER','ACTIVE')");
  try(var stream=Objects.requireNonNull(getClass().getResourceAsStream("/db/migration/V58__company_meeting_minutes.sql"))) {
   db.execute(new String(stream.readAllBytes(),StandardCharsets.UTF_8));
  }
  auth=mock(Authentication.class);users=mock(CurrentUserService.class);
  when(users.require(auth)).thenReturn(new CurrentUserService.CurrentUser(10,1,"qa@example.test","QA","USER","ACTIVE"));
  controller=new WorkspaceMeetings(db,users,mock(AuditService.class));
 }
 @AfterEach void cleanup(){if(db!=null){db.execute("DROP TABLE IF EXISTS workspace_meeting");db.execute("DROP TABLE IF EXISTS company");}}
 @Test void generatedIdContentRevisionAndSoftDeletionWorkOnMariaDb() {
  var input=new WorkspaceMeetings.Input("10월 회의록",LocalDateTime.of(2026,10,27,10,0),"<h2>지난주 진행 내용</h2><p>PM 완료 &amp; 수리</p>","QA, 직원",null);
  long id=controller.create(input,auth).get("id");
  var row=controller.get(id,auth);assertEquals(input.contentMarkdown(),row.get("contentMarkdown"));assertEquals(1L,((Number)row.get("revision")).longValue());assertEquals("2026-10-27T10:00",row.get("meetingAt"));
  var changed=new WorkspaceMeetings.Input("날짜 수정",input.meetingAt().plusDays(1),input.contentMarkdown(),input.participantNames(),1L);
  controller.update(id,changed,auth);assertEquals(2L,((Number)controller.get(id,auth).get("revision")).longValue());
  assertThrows(ConflictException.class,()->controller.update(id,changed,auth));
  when(users.require(auth)).thenReturn(new CurrentUserService.CurrentUser(20,2,"other@example.test","Other","ADMIN","ACTIVE"));
  assertFalse(controller.access(auth).get("allowed"));assertThrows(ForbiddenException.class,()->controller.get(id,auth));
  when(users.require(auth)).thenReturn(new CurrentUserService.CurrentUser(11,1,"colleague@example.test","Colleague","USER","ACTIVE"));
  assertThrows(ForbiddenException.class,()->controller.delete(id,2,auth));
  when(users.require(auth)).thenReturn(new CurrentUserService.CurrentUser(10,1,"qa@example.test","QA","USER","ACTIVE"));
  assertThrows(ConflictException.class,()->controller.delete(id,1,auth));
  controller.delete(id,2,auth);assertTrue(controller.list(auth).isEmpty());assertThrows(NotFoundException.class,()->controller.get(id,auth));
  assertEquals(1,db.queryForObject("SELECT COUNT(*) FROM workspace_meeting WHERE deleted_at IS NOT NULL",Integer.class));
 }
}
