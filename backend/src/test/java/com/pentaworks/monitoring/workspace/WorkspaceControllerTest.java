package com.pentaworks.monitoring.workspace;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.pentaworks.monitoring.auth.CurrentUserService;
import com.pentaworks.monitoring.common.*;
import java.time.LocalDate;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
class WorkspaceControllerTest {
 @Test void fieldRequiresHospitalAndServiceType(){assertThrows(BadRequestException.class,()->WorkspaceController.validate(new WorkspaceController.WorkInput("FIELD",null,"PM","title","body",LocalDate.now(),"COMPLETED")));assertThrows(BadRequestException.class,()->WorkspaceController.validate(new WorkspaceController.WorkInput("FIELD","001","UNKNOWN","title","body",LocalDate.now(),"COMPLETED")));}
 @Test void generalRecordDoesNotRequireHospital(){assertDoesNotThrow(()->WorkspaceController.validate(new WorkspaceController.WorkInput("GENERAL",null,null,"title","body",LocalDate.now(),"COMPLETED")));}
 @Test void siteRestrictedRecordsAreFiltered(){var db=mock(JdbcTemplate.class);var users=mock(CurrentUserService.class);var auth=mock(Authentication.class);var u=new CurrentUserService.CurrentUser(2,3,"user@test","User","USER","ACTIVE");when(users.require(auth)).thenReturn(u);when(users.allowedSiteIds(u)).thenReturn(Set.of("001"));var visible=new HashMap<String,Object>();visible.put("id",1);visible.put("siteId","001");var hidden=new HashMap<String,Object>();hidden.put("id",2);hidden.put("siteId","002");var general=new HashMap<String,Object>();general.put("id",3);when(db.queryForList(anyString(),eq(3L))).thenReturn(List.of(visible,hidden,general));assertEquals(List.of(visible,general),new WorkspaceController(db,users,mock(org.springframework.context.ApplicationEventPublisher.class)).records(auth));}
 @Test void anotherCompanyRecordCannotBeDeleted(){var db=mock(JdbcTemplate.class);var users=mock(CurrentUserService.class);var auth=mock(Authentication.class);when(users.require(auth)).thenReturn(new CurrentUserService.CurrentUser(2,3,"user@test","User","USER","ACTIVE"));when(db.queryForList(anyString(),eq(10L),eq(3L))).thenReturn(List.of());assertThrows(NotFoundException.class,()->new WorkspaceController(db,users,mock(org.springframework.context.ApplicationEventPublisher.class)).delete(10,auth));verify(db,never()).update(anyString(),any(Object[].class));}
 @Test void colleagueRecordCannotBeDeleted(){var db=mock(JdbcTemplate.class);var users=mock(CurrentUserService.class);var auth=mock(Authentication.class);when(users.require(auth)).thenReturn(new CurrentUserService.CurrentUser(2,3,"user@test","User","USER","ACTIVE"));when(db.queryForList(anyString(),eq(10L),eq(3L))).thenReturn(List.of(Map.of("author_id",4L)));assertThrows(ForbiddenException.class,()->new WorkspaceController(db,users,mock(org.springframework.context.ApplicationEventPublisher.class)).delete(10,auth));}
}
