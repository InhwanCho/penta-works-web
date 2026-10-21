package com.pentaworks.monitoring.workspace;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.security.core.Authentication;
import com.pentaworks.monitoring.auth.CurrentUserService;
import com.pentaworks.monitoring.common.*;
import org.springframework.context.ApplicationEventPublisher;
@EnabledIfEnvironmentVariable(named="WORKSPACE_TEST_DB_URL",matches="jdbc:mariadb://127\\.0\\.0\\.1:13369/mreyes_workspace_qa")
class WorkspaceDatabaseTest {
 JdbcTemplate db; TransactionTemplate tx; WorkspaceController controller; Authentication auth; CurrentUserService users;
 @BeforeEach void setup(){
  var ds=new DriverManagerDataSource(System.getenv("WORKSPACE_TEST_DB_URL"),"root","");db=new JdbcTemplate(ds);tx=new TransactionTemplate(new DataSourceTransactionManager(ds));
  for(String t:List.of("workspace_hospital_plan","workspace_change_history","workspace_asset_history","workspace_preparation","workspace_photo","workspace_record","workspace_schedule","workspace_hospital","app_user","site"))db.execute("DROP TABLE IF EXISTS "+t);
  db.execute("CREATE TABLE app_user(id BIGINT PRIMARY KEY,name VARCHAR(100))");db.execute("INSERT INTO app_user VALUES(1,'QA')");
  db.execute("CREATE TABLE site(site VARCHAR(32) PRIMARY KEY,name VARCHAR(100))");db.execute("INSERT INTO site VALUES('001','허용병원'),('002','비허용병원')");
  db.execute("CREATE TABLE workspace_hospital(company_id BIGINT,site_id VARCHAR(32),name VARCHAR(100))");
  db.execute("CREATE TABLE workspace_schedule(id BIGINT AUTO_INCREMENT PRIMARY KEY,company_id BIGINT,author_id BIGINT,site_id VARCHAR(32),title VARCHAR(200),body TEXT,start_at DATETIME,end_at DATETIME,target_kind VARCHAR(20),personal_kind VARCHAR(20),service_type VARCHAR(20),revision BIGINT DEFAULT 1,deleted_at DATETIME)");
  db.execute("CREATE TABLE workspace_record(id BIGINT AUTO_INCREMENT PRIMARY KEY,company_id BIGINT,author_id BIGINT,site_id VARCHAR(32),engineer_name VARCHAR(200),counts_as_pm BOOLEAN,acr_kind VARCHAR(20),schedule_id BIGINT,source_id VARCHAR(128),kind VARCHAR(20),service_type VARCHAR(20),title VARCHAR(200),body LONGTEXT,work_date DATE,status VARCHAR(20),details_json JSON,revision BIGINT DEFAULT 1,updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,deleted_at DATETIME)");
  db.execute("CREATE TABLE workspace_change_history(id BIGINT AUTO_INCREMENT PRIMARY KEY,company_id BIGINT,resource_type VARCHAR(16),resource_id BIGINT,revision BIGINT,action VARCHAR(16),actor_id BIGINT,snapshot_json LONGTEXT,created_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
  db.execute("CREATE TABLE workspace_asset_history(record_id BIGINT,asset_id BIGINT,change_kind VARCHAR(20))");db.execute("CREATE TABLE workspace_photo(id BIGINT,record_id BIGINT,company_id BIGINT)");
  db.execute("CREATE TABLE workspace_preparation(id BIGINT,record_id BIGINT,company_id BIGINT,author_id BIGINT,site_id VARCHAR(32),content TEXT,created_at DATETIME,done BOOLEAN)");
  db.execute("CREATE TABLE workspace_hospital_plan(company_id BIGINT,site_id VARCHAR(32),pm_interval_months INT,pm_override DATE,acr_full_override DATE,acr_doc_override DATE,last_pm_date DATE,last_acr_full_date DATE,last_acr_doc_date DATE)");
  users=mock(CurrentUserService.class);auth=mock(Authentication.class);var user=new CurrentUserService.CurrentUser(1,1,"qa@example.invalid","QA","USER","ACTIVE");when(users.require(auth)).thenReturn(user);when(users.allowedSiteIds(user)).thenReturn(Set.of("001"));
  controller=new WorkspaceController(db,users,mock(ApplicationEventPublisher.class));
 }
 void record(long id,String site){db.update("INSERT INTO workspace_record(id,company_id,author_id,site_id,kind,title,body,work_date,status,details_json) VALUES(?,1,1,?,'GENERAL',?,'본문','2026-10-21','COMPLETED','{}')",id,site,"기록"+id);}
 WorkspaceController.WorkInput input(long revision){return new WorkspaceController.WorkInput("GENERAL",null,null,"수정제목","수정본문",LocalDate.of(2026,10,21),"COMPLETED",null,null,revision);}
 @Test void oldRecordsRemainAddressableAndPaginationFiltersBeforeLimiting(){
  for(int i=1;i<=520;i++)record(i,i>510?"002":null);
  assertEquals(510,controller.records(auth).size());assertEquals(1L,((Number)controller.record(1,auth).get("id")).longValue());
  var page=controller.searchRecords(1,20,"","ALL",false,auth);assertEquals(510L,page.get("total"));var rows=(List<?>)page.get("records");assertEquals(20,rows.size());
  assertThrows(NotFoundException.class,()->controller.record(520,auth));
  assertEquals(111L,controller.searchRecords(1,20,"기록1","ALL",false,auth).get("total"));
 }
 @Test void futureDateWindowAndOverlappingSchedulesDoNotUseTodayCutoff(){
  record(1,"001");record(2,"001");db.update("UPDATE workspace_record SET work_date='2029-10-15' WHERE id=2");
  var future=controller.records(LocalDate.of(2029,4,1),LocalDate.of(2030,3,31),null,auth);assertEquals(1,future.size());assertEquals(2L,((Number)future.get(0).get("id")).longValue());assertEquals(1L,((Number)controller.record(1,auth).get("id")).longValue());
  db.update("INSERT INTO workspace_schedule(company_id,author_id,title,body,start_at,end_at) VALUES(1,1,'長期','','2029-03-01','2030-05-01')");assertEquals(1,controller.schedules(LocalDate.of(2029,4,1),LocalDate.of(2030,3,31),auth).size());
  assertThrows(BadRequestException.class,()->controller.records(LocalDate.of(2030,1,1),LocalDate.of(2029,1,1),null,auth));
 }
 @Test void inspectionCompletionIncludesRecordsOlderThanCalendarWindow(){
  record(1,"001");record(2,"001");db.update("UPDATE workspace_record SET service_type='PM',work_date='2020-01-15' WHERE id=1");db.update("UPDATE workspace_record SET service_type='PM',work_date='2030-01-15',status='IN_PROGRESS' WHERE id=2");
  var planning=new WorkspacePlanning(db,users,mock(ApplicationEventPublisher.class));var plans=(List<?>)planning.planning(auth).get("plans");assertEquals(1,plans.size());assertEquals("2020-01-15",((Map<?,?>)plans.get(0)).get("lastPmDate"));
  db.update("INSERT INTO workspace_hospital_plan(company_id,site_id,pm_interval_months,last_pm_date) VALUES(1,'001',2,'2021-01-01')");plans=(List<?>)planning.planning(auth).get("plans");assertEquals("2021-01-01",((Map<?,?>)plans.get(0)).get("lastPmDate"));
 }
 @Test void competingEditsCommitOnceAndKeepBeforeAfterHistory() throws Exception {
  record(1,null);var pool=Executors.newFixedThreadPool(2);var gate=new CountDownLatch(1);
  try{var tasks=new ArrayList<Future<Boolean>>();for(int i=0;i<2;i++)tasks.add(pool.submit(()->{gate.await();try{tx.executeWithoutResult(s->controller.update(1,input(1),auth));return true;}catch(ConflictException expected){return false;}}));gate.countDown();int success=0;for(var f:tasks)if(f.get(10,TimeUnit.SECONDS))success++;assertEquals(1,success);
   assertEquals(2L,db.queryForObject("SELECT revision FROM workspace_record WHERE id=1",Long.class));assertEquals(2,db.queryForObject("SELECT COUNT(*) FROM workspace_change_history",Integer.class));assertTrue(controller.recordHistory(1,auth).get(0).get("snapshotJson").toString().contains("수정본문"));
  }finally{pool.shutdownNow();}
 }
 @Test void scheduleEditsKeepLinkedRecordAndRejectHospitalChange(){
  record(1,"001");db.update("INSERT INTO workspace_schedule(id,company_id,author_id,site_id,title,body,start_at,end_at,target_kind,service_type) VALUES(1,1,1,'001','PM','','2026-10-21 09:00:00','2026-10-21 10:00:00','HOSPITAL','PM')");db.update("UPDATE workspace_record SET schedule_id=1 WHERE id=1");
  var i=new WorkspaceController.ScheduleInput("001","변경","내용",LocalDateTime.of(2026,10,22,9,0),LocalDateTime.of(2026,10,22,10,0),"HOSPITAL",null,"PM",1L);
  tx.executeWithoutResult(s->controller.updateSchedule(1,i,auth));assertEquals(1L,db.queryForObject("SELECT schedule_id FROM workspace_record WHERE id=1",Long.class));assertEquals(2L,db.queryForObject("SELECT revision FROM workspace_schedule WHERE id=1",Long.class));assertThrows(ConflictException.class,()->tx.executeWithoutResult(s->controller.updateSchedule(1,i,auth)));
  var other=new WorkspaceController.ScheduleInput(null,"변경","내용",i.startAt(),i.endAt(),"GENERAL","etc",null,2L);assertThrows(BadRequestException.class,()->tx.executeWithoutResult(s->controller.updateSchedule(1,other,auth)));assertEquals("001",db.queryForObject("SELECT site_id FROM workspace_schedule WHERE id=1",String.class));
  assertEquals(1,controller.schedules(LocalDate.of(2026,10,22),LocalDate.of(2026,10,22),auth).size());assertTrue(controller.schedules(LocalDate.of(2026,10,21),LocalDate.of(2026,10,21),auth).isEmpty());
 }
}
