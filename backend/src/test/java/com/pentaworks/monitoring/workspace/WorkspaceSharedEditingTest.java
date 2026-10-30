package com.pentaworks.monitoring.workspace;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.pentaworks.monitoring.auth.CurrentUserService;
import com.pentaworks.monitoring.common.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
class WorkspaceSharedEditingTest {
 final JdbcTemplate db=mock(JdbcTemplate.class);
 final CurrentUserService users=mock(CurrentUserService.class);
 final Authentication auth=mock(Authentication.class);
 final CurrentUserService.CurrentUser user=new CurrentUserService.CurrentUser(2,3,"user@test","User","USER","ACTIVE");
 final WorkspaceController controller=new WorkspaceController(db,users,mock(org.springframework.context.ApplicationEventPublisher.class));
 @BeforeEach void setup(){when(users.require(auth)).thenReturn(user);when(db.queryForList(anyString(),eq(10L),eq(3L))).thenReturn(List.of(Map.of("author_id",4L,"revision",1L)));when(db.queryForObject(anyString(),eq(Long.class),eq(10L),eq(3L))).thenReturn(1L);}
 WorkspaceController.ScheduleInput schedule(long revision){return new WorkspaceController.ScheduleInput(null,"일정","메모",LocalDateTime.of(2026,10,30,0,0),LocalDateTime.of(2026,10,30,23,59),"GENERAL","etc",null,revision);}
 @Test void colleagueCanEditRecord(){assertTrue((Boolean)controller.update(10,new WorkspaceController.WorkInput("GENERAL",null,null,"업무","내용",LocalDate.of(2026,10,30),"COMPLETED",Map.of(),null,1L),auth).get("saved"));}
 @Test void colleagueCanEditSchedule(){assertTrue(controller.updateSchedule(10,schedule(1),auth).get("saved"));}
 @Test void colleagueCanDeleteSchedule(){assertTrue(controller.deleteSchedule(10,auth).get("deleted"));}
 @Test void staleRevisionStillRejected(){assertThrows(ConflictException.class,()->controller.updateSchedule(10,schedule(2),auth));verify(db,never()).update(anyString(),any(Object[].class));}
 @Test void inaccessibleHospitalStillRejected(){when(db.queryForList(anyString(),eq(10L),eq(3L))).thenReturn(List.of(Map.of("author_id",4L,"siteId","002")));doThrow(new ForbiddenException("거부")).when(users).requireSiteAccess(user,"002");assertThrows(ForbiddenException.class,()->controller.delete(10,auth));assertThrows(ForbiddenException.class,()->controller.deleteSchedule(10,auth));verify(db,never()).update(anyString(),any(Object[].class));}
 @Test void anotherCompanyScheduleStillMissing(){when(db.queryForList(anyString(),eq(10L),eq(3L))).thenReturn(List.of());assertThrows(NotFoundException.class,()->controller.deleteSchedule(10,auth));assertThrows(NotFoundException.class,()->controller.updateSchedule(10,schedule(1),auth));}
}
