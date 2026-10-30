package com.pentaworks.monitoring.workspace;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.time.LocalDate;
import com.pentaworks.monitoring.auth.CurrentUserService;
import com.pentaworks.monitoring.common.*;
import org.junit.jupiter.api.*;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
class PmDatePermissionTest {
 JdbcTemplate db=mock(JdbcTemplate.class);CurrentUserService users=mock(CurrentUserService.class);
 ApplicationEventPublisher events=mock(ApplicationEventPublisher.class);Authentication auth=mock(Authentication.class);
 CurrentUserService.CurrentUser user=new CurrentUserService.CurrentUser(1,7,"qa@example.invalid","QA","USER","ACTIVE");
 WorkspacePlanning controller=new WorkspacePlanning(db,users,events);
 @BeforeEach void setup(){when(users.require(auth)).thenReturn(user);}
 @Test void ordinaryUserCanChangeOnlyPmDate(){
  var date=LocalDate.of(2026,11,2);assertTrue(controller.pmDate("001",new WorkspacePlanning.PmDateInput(date),auth).get("saved"));
  verify(users).requireSiteAccess(user,"001");
  verify(db).update("INSERT INTO workspace_hospital_plan(company_id,site_id,pm_interval_months,pm_override) VALUES(?,?,2,?) ON DUPLICATE KEY UPDATE pm_override=VALUES(pm_override)",7L,"001",date);
  verify(events).publishEvent(any(com.pentaworks.monitoring.calendar.CalendarChanged.class));
 }
 @Test void inaccessibleHospitalCannotBeChanged(){doThrow(new ForbiddenException("거부")).when(users).requireSiteAccess(user,"002");assertThrows(ForbiddenException.class,()->controller.pmDate("002",new WorkspacePlanning.PmDateInput(LocalDate.now()),auth));verifyNoInteractions(db,events);}
 @Test void periodChangesRemainAdminOnly(){assertThrows(ForbiddenException.class,()->controller.plan("001",new WorkspacePlanning.PlanInput(4,null,null,null),auth));verifyNoInteractions(db,events);}
 @Test void missingDateCannotBeSaved(){assertThrows(BadRequestException.class,()->controller.pmDate("001",new WorkspacePlanning.PmDateInput(null),auth));verifyNoInteractions(db,events);}
 @Test void completedPmCannotBeMovedBackwards(){when(db.queryForObject(anyString(),eq(LocalDate.class),eq(7L),eq("001"),eq(7L),eq("001"))).thenReturn(LocalDate.of(2026,11,2));assertThrows(BadRequestException.class,()->controller.pmDate("001",new WorkspacePlanning.PmDateInput(LocalDate.of(2026,11,2)),auth));verify(db,never()).update(anyString(),any(Object[].class));verifyNoInteractions(events);}

 @Test void automaticClearsOnlySelectedOverride(){controller.dueDate("001",new WorkspacePlanning.DueDateInput("ACR_FULL",null,true),auth);verify(users).requireSiteAccess(user,"001");verify(db).update("INSERT INTO workspace_hospital_plan(company_id,site_id,pm_interval_months,acr_full_override) VALUES(?,?,2,?) ON DUPLICATE KEY UPDATE acr_full_override=VALUES(acr_full_override)",7L,"001",null);}
 @Test void automaticCannotAccessAnotherHospital(){doThrow(new ForbiddenException("거부")).when(users).requireSiteAccess(user,"002");assertThrows(ForbiddenException.class,()->controller.dueDate("002",new WorkspacePlanning.DueDateInput("PM",null,true),auth));verifyNoInteractions(db,events);}
 @Test void invalidInspectionTypeCannotReachSql(){assertThrows(BadRequestException.class,()->controller.dueDate("001",new WorkspacePlanning.DueDateInput("bad_column",null,true),auth));verifyNoInteractions(db,events);}
 @Test void ordinaryUserCanChangeAcrDocDate(){var date=LocalDate.of(2026,11,2);controller.dueDate("001",new WorkspacePlanning.DueDateInput("ACR_DOC",date,false),auth);verify(db).update("INSERT INTO workspace_hospital_plan(company_id,site_id,pm_interval_months,acr_doc_override) VALUES(?,?,2,?) ON DUPLICATE KEY UPDATE acr_doc_override=VALUES(acr_doc_override)",7L,"001",date);}
}
