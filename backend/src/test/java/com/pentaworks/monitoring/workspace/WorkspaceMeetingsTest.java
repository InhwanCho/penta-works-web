package com.pentaworks.monitoring.workspace;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.time.LocalDateTime;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import com.pentaworks.monitoring.auth.CurrentUserService;
import com.pentaworks.monitoring.admin.AuditService;
import com.pentaworks.monitoring.common.*;

class WorkspaceMeetingsTest {
 JdbcTemplate db; CurrentUserService users; Authentication auth; WorkspaceMeetings controller;
 @BeforeEach void setup() {
  db=mock(JdbcTemplate.class);users=mock(CurrentUserService.class);auth=mock(Authentication.class);
  when(users.require(auth)).thenReturn(new CurrentUserService.CurrentUser(8,2,"qa@example.test","QA","USER","ACTIVE"));
  controller=new WorkspaceMeetings(db,users,mock(AuditService.class));
 }
 @Test void otherCompaniesCannotListReadOrWriteEvenAsAdmins() {
  when(users.require(auth)).thenReturn(new CurrentUserService.CurrentUser(8,2,"qa@example.test","QA","ADMIN","ACTIVE"));
  when(db.queryForObject(anyString(),eq(Boolean.class),eq(2L))).thenReturn(false);
  assertFalse(controller.access(auth).get("allowed"));
  assertThrows(ForbiddenException.class,()->controller.list(auth));
  assertThrows(ForbiddenException.class,()->controller.get(4,auth));
  assertThrows(ForbiddenException.class,()->controller.create(null,auth));
  assertThrows(ForbiddenException.class,()->controller.update(4,null,auth));
  assertThrows(ForbiddenException.class,()->controller.delete(4,1,auth));
  verify(db,never()).queryForList(anyString(),any(Object[].class));
 }
 @Test void readsAreScopedToTheCurrentCompany() {
  when(db.queryForObject(anyString(),eq(Boolean.class),eq(2L))).thenReturn(true);
  when(db.queryForList(anyString(),eq(2L),eq(99L))).thenReturn(List.of());
  assertThrows(NotFoundException.class,()->controller.get(99,auth));
  verify(db).queryForList(contains("company_id=?"),eq(2L),eq(99L));
 }
 @Test void colleaguesCanCollaborateButStaleUpdatesAreRejected() {
  when(db.queryForObject(anyString(),eq(Boolean.class),eq(2L))).thenReturn(true);
  when(db.queryForList(anyString(),eq(2L),eq(4L))).thenReturn(List.of(Map.of("authorId",99L)));
  var input=new WorkspaceMeetings.Input("회의록",LocalDateTime.now(),"실제 내용","",1L);
  assertThrows(ConflictException.class,()->controller.update(4,input,auth));
  verify(db).update(contains("AND company_id=? AND deleted_at IS NULL AND revision=?"),eq("회의록"),eq(input.meetingAt()),eq("실제 내용"),eq(""),eq(8L),eq("QA"),eq(4L),eq(2L),eq(1L));
 }
 @Test void colleagueAndImportedMeetingsCannotBeDeletedByOrdinaryUsers() {
  when(db.queryForObject(anyString(),eq(Boolean.class),eq(2L))).thenReturn(true);
  for(var row:List.of(Map.<String,Object>of("authorId",99L),Map.<String,Object>of("title","imported"))) {
   when(db.queryForList(anyString(),eq(2L),eq(4L))).thenReturn(List.of(row));
   assertThrows(ForbiddenException.class,()->controller.delete(4,1,auth));
  }
 }
 @Test void headingsAloneAreNotMeetingContent() {
  var now=LocalDateTime.now();
  assertThrows(BadRequestException.class,()->WorkspaceMeetings.validate(new WorkspaceMeetings.Input("회의",now,"<h2>지난주 진행 내용</h2><p>&nbsp;</p><h2>진행 중인 일·이슈</h2><h2>이번 주·예정 작업</h2>","",null)));
  assertDoesNotThrow(()->WorkspaceMeetings.validate(new WorkspaceMeetings.Input("회의",now,"<h2>지난주 진행 내용</h2><p>PM 완료</p>","",null)));
 }
}
