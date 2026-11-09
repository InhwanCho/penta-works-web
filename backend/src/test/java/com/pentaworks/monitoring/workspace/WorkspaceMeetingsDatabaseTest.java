package com.pentaworks.monitoring.workspace;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
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
  cleanup();
  db.execute("CREATE TABLE company(id BIGINT UNSIGNED PRIMARY KEY,code VARCHAR(100),status VARCHAR(20))");
  db.execute("INSERT INTO company VALUES(1,'PENTAWORKS','ACTIVE'),(2,'OTHER','ACTIVE')");
  try(var stream=Objects.requireNonNull(getClass().getResourceAsStream("/db/migration/V58__company_meeting_minutes.sql"))) {
   db.execute(new String(stream.readAllBytes(),StandardCharsets.UTF_8));
  }
  db.execute("CREATE TABLE workspace_record(id BIGINT PRIMARY KEY, company_id BIGINT NOT NULL, site_id VARCHAR(32), deleted_at DATETIME(6))");
  new ResourceDatabasePopulator(
      new ClassPathResource("db/migration/V39__workspace_service_forms_and_photos.sql"),
      new ClassPathResource("db/migration/V57__external_workspace_photo_storage.sql"),
      new ClassPathResource("db/migration/V61__workspace_meeting_photos.sql")
  ).execute(Objects.requireNonNull(db.getDataSource()));
  auth=mock(Authentication.class);users=mock(CurrentUserService.class);
  when(users.require(auth)).thenReturn(new CurrentUserService.CurrentUser(10,1,"qa@example.test","QA","USER","ACTIVE"));
  controller=new WorkspaceMeetings(db,users,mock(AuditService.class));
 }
 @AfterEach void cleanup() {
  if (db == null) return;
  for (String table : List.of("workspace_photo", "workspace_record", "workspace_hospital_plan", "workspace_preparation", "workspace_meeting", "company")) {
   db.execute("DROP TABLE IF EXISTS " + table);
  }
 }

 @Test void meetingPhotosCanBeReadByColleaguesButNotReattachedOrReadByAnotherCompany() {
  byte[] image = {1, 2, 3};
  db.update("""
      INSERT INTO workspace_photo(id, company_id, author_id, original_name, mime_type, image_data, byte_size, width_px, height_px)
      VALUES(15,1,10,'meeting.png','image/png',?,3,1,1)
      """, image);
  var input = new WorkspaceMeetings.Input("회의록", LocalDateTime.now(), "회의 내용", "", null, List.of(15L));
  long meeting = controller.create(input, auth).get("id");
  var photos = new WorkspacePhotos(db, users);
  var colleague = new CurrentUserService.CurrentUser(11, 1, "colleague@example.test", "Colleague", "USER", "ACTIVE");
  when(users.require(auth)).thenReturn(colleague);
  assertEquals(15L, ((Number) controller.photos(meeting, auth).get(0).get("id")).longValue());
  assertArrayEquals(image, photos.image(15, auth).getBody());
  assertThrows(ForbiddenException.class, () -> photos.attachMeeting(colleague, meeting + 1, List.of(15L)));
  db.update("INSERT INTO workspace_record(id, company_id) VALUES(99,1)");
  assertThrows(ForbiddenException.class, () -> photos.attach(colleague, 99, List.of(15L)));
  when(users.require(auth)).thenReturn(new CurrentUserService.CurrentUser(20, 2, "other@example.test", "Other", "ADMIN", "ACTIVE"));
  assertThrows(ForbiddenException.class, () -> controller.photos(meeting, auth));
  assertThrows(NotFoundException.class, () -> photos.image(15, auth));
  when(users.require(auth)).thenReturn(colleague);
  controller.update(meeting, new WorkspaceMeetings.Input(input.title(), input.meetingAt(), input.contentMarkdown(), "", 1L, List.of()), auth);
  assertTrue(controller.photos(meeting, auth).isEmpty());
  assertThrows(NotFoundException.class, () -> photos.image(15, auth));
 }

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
