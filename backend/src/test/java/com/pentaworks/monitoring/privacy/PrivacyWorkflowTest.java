package com.pentaworks.monitoring.privacy;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pentaworks.monitoring.auth.CurrentUserService;
import com.pentaworks.monitoring.admin.*;
import com.pentaworks.monitoring.common.*;
import java.nio.file.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class PrivacyWorkflowTest {
 @TempDir Path directory;
 final CurrentUserService.CurrentUser user=new CurrentUserService.CurrentUser(7,1,"a@example.com","담당자","USER","ACTIVE");
 final CurrentUserService.CurrentUser admin=new CurrentUserService.CurrentUser(9,1,"admin@example.com","관리자","SUPER_ADMIN","ACTIVE");
 @Test void kindsAndContentAreValidated(){
  assertThrows(BadRequestException.class,()->PrivacyRequestController.validate(new PrivacyRequestController.Create("BOGUS","x")));
  assertThrows(BadRequestException.class,()->PrivacyRequestController.validate(new PrivacyRequestController.Create("DELETE_ACCOUNT"," ")));
  assertDoesNotThrow(()->PrivacyRequestController.validate(new PrivacyRequestController.Create("ERASURE","해당 기록의 사진을 확인해주세요")));
 }
 @Test void usersCannotManageCompanyRequests(){
  var db=mock(JdbcTemplate.class);var users=mock(CurrentUserService.class);var auth=mock(Authentication.class);when(users.require(auth)).thenReturn(user);
  var service=new PrivacyRequestController(db,users,mock(AuditService.class),mock(AdminAccountService.class));
  assertThrows(ForbiddenException.class,()->service.manage(auth));verifyNoInteractions(db);
 }
 @Test void anotherCompanyRequestCannotBeProcessed(){
  var db=mock(JdbcTemplate.class);var users=mock(CurrentUserService.class);var auth=mock(Authentication.class);when(users.require(auth)).thenReturn(admin);
  when(db.queryForList(anyString(),eq("id"),eq(1L))).thenReturn(List.of());
  var accounts=mock(AdminAccountService.class);var service=new PrivacyRequestController(db,users,mock(AuditService.class),accounts);
  assertThrows(NotFoundException.class,()->service.deleteAccount("id",new PrivacyRequestController.DeleteAccount("x",true),auth));verifyNoInteractions(accounts);
 }
 @Test void deletingNeedsVerifiedIdentityAndUsesExistingGuardedDeletion(){
  var db=mock(JdbcTemplate.class);var users=mock(CurrentUserService.class);var auth=mock(Authentication.class);when(users.require(auth)).thenReturn(admin);
  when(db.queryForList(anyString(),eq("id"),eq(1L))).thenReturn(List.of(Map.of("kind","DELETE_ACCOUNT","status","RECEIVED","user_id",7L)));
  var accounts=mock(AdminAccountService.class);var service=new PrivacyRequestController(db,users,mock(AuditService.class),accounts);
  assertThrows(BadRequestException.class,()->service.deleteAccount("id",new PrivacyRequestController.DeleteAccount("a@example.com",false),auth));verifyNoInteractions(accounts);
  service.deleteAccount("id",new PrivacyRequestController.DeleteAccount("a@example.com",true),auth);verify(accounts).deleteUser(admin,7,"a@example.com");
 }
 @Test void journalRecordsCommitOrAbortWithoutNamesAndEmails()throws Exception{
  var db=mock(JdbcTemplate.class);when(db.queryForObject(anyString(),eq(java.sql.Timestamp.class),eq(7L),eq(1L))).thenReturn(java.sql.Timestamp.valueOf("2026-10-01 09:00:00"));
  var journal=new PrivacyDeletionJournal(db,new ObjectMapper(),directory.toString());
  var transactions=new TransactionTemplate(new AbstractPlatformTransactionManager(){
   protected Object doGetTransaction(){return new Object();}protected void doBegin(Object tx,TransactionDefinition d){}protected void doCommit(DefaultTransactionStatus s){}protected void doRollback(DefaultTransactionStatus s){}
  });
  transactions.execute(s->{journal.prepare(1,7);return null;});
  transactions.execute(s->{journal.prepare(1,7);s.setRollbackOnly();return null;});
  var lines=Files.readAllLines(directory.resolve("deletions.jsonl"));assertEquals(4,lines.size());assertTrue(lines.get(0).contains("PREPARE"));assertTrue(lines.get(1).contains("COMMIT"));assertTrue(lines.get(3).contains("ABORT"));assertFalse(String.join("",lines).contains("@example"));
  assertThrows(IllegalStateException.class,()->journal.prepare(1,7));
 }
}
