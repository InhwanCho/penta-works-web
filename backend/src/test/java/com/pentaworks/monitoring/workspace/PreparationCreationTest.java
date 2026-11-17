package com.pentaworks.monitoring.workspace;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.pentaworks.monitoring.auth.CurrentUserService;
import com.pentaworks.monitoring.common.*;
import org.junit.jupiter.api.*;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
class PreparationCreationTest {
 JdbcTemplate db=mock(JdbcTemplate.class); CurrentUserService users=mock(CurrentUserService.class);
 Authentication auth=mock(Authentication.class);
 CurrentUserService.CurrentUser user=new CurrentUserService.CurrentUser(1,7,"qa@example.invalid","QA","USER","ACTIVE");
 WorkspacePlanning controller=new WorkspacePlanning(db,users,mock(ApplicationEventPublisher.class));
 @BeforeEach void setup(){when(users.require(auth)).thenReturn(user);}
 @Test void savesStandalonePreparationInUserCompany(){
  controller.createPreparation(new WorkspacePlanning.PreparationInput("001","  부품 준비  "),auth);
  verify(users).requireSiteAccess(user,"001");
  verify(db).update("INSERT INTO workspace_preparation(company_id,author_id,site_id,content) VALUES(?,?,?,?)",7L,1L,"001","부품 준비");
 }
 @Test void registersEachNonblankLineAsAnIndependentItem(){
  controller.createPreparation(new WorkspacePlanning.PreparationInput("001","- 일일점검표\r\n\r\n• 테이블"),auth);
  String insert="INSERT INTO workspace_preparation(company_id,author_id,site_id,content) VALUES(?,?,?,?)";
  var ordered=inOrder(db);
  ordered.verify(db).update(insert,7L,1L,"001","일일점검표");
  ordered.verify(db).update(insert,7L,1L,"001","테이블");
  verifyNoMoreInteractions(db);
 }
 @Test void rejectsInaccessibleHospital(){
  doThrow(new ForbiddenException("거부")).when(users).requireSiteAccess(user,"002");
  assertThrows(ForbiddenException.class,()->controller.createPreparation(new WorkspacePlanning.PreparationInput("002","준비"),auth));verifyNoInteractions(db);
 }
 @Test void rejectsMissingOrOversizedFields(){
  for(var input: new WorkspacePlanning.PreparationInput[]{new WorkspacePlanning.PreparationInput(null,"준비"),new WorkspacePlanning.PreparationInput("001"," "),new WorkspacePlanning.PreparationInput("001","가".repeat(1001))})
   assertThrows(BadRequestException.class,()->controller.createPreparation(input,auth));
  verifyNoInteractions(db);
 }
}
