package com.pentaworks.monitoring.workspace;

import com.pentaworks.monitoring.auth.CurrentUserService;
import com.pentaworks.monitoring.auth.CurrentUserService.CurrentUser;
import com.pentaworks.monitoring.common.BadRequestException;
import com.pentaworks.monitoring.common.ForbiddenException;
import com.pentaworks.monitoring.common.NotFoundException;
import com.pentaworks.monitoring.site.SiteService;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/workspace")
@ConditionalOnProperty(name="app.workspace.enabled",havingValue="true")
public class WorkspaceController {
    private final JdbcTemplate db;
    private final CurrentUserService users;
    public WorkspaceController(JdbcTemplate db, CurrentUserService users) {this.db=db;this.users=users;}
    public record WorkInput(String kind,String siteId,String serviceType,String title,String body,LocalDate workDate,String status,Map<String,Object> details,List<Long> photoIds) {
        public WorkInput(String kind,String siteId,String serviceType,String title,String body,LocalDate workDate,String status) {this(kind,siteId,serviceType,title,body,workDate,status,null,null);}
    }
    private final ObjectMapper mapper=new ObjectMapper();
    private String detailsJson(WorkInput input) {
        try {String json=mapper.writeValueAsString(input.details()==null?Map.of():input.details());if(json.length()>250000)throw new BadRequestException("점검 항목의 내용이 너무 큽니다.");return json;}
        catch(JsonProcessingException e){throw new BadRequestException("작업 상세를 확인해주세요.");}
    }
    public record ScheduleInput(String siteId,String title,String body,LocalDateTime startAt,LocalDateTime endAt) {}
    private static final String RECORDS="""
        SELECT w.id,w.author_id authorId,u.name authorName,w.site_id siteId,s.name siteName,
               w.kind,w.service_type serviceType,w.title,w.body,DATE_FORMAT(w.work_date,'%Y-%m-%d') workDate,w.status,w.details_json detailsJson,w.updated_at updatedAt
        FROM workspace_record w JOIN app_user u ON u.id=w.author_id LEFT JOIN site s ON s.site=w.site_id
        WHERE w.company_id=? AND w.deleted_at IS NULL ORDER BY w.work_date DESC,w.id DESC LIMIT 500
        """;
    @GetMapping("/records")
    public List<Map<String,Object>> records(Authentication auth) {
        var u=users.require(auth);var allowed=users.allowedSiteIds(u);
        return db.queryForList(RECORDS,u.companyId()).stream().filter(r->visible(r,allowed)).toList();
    }
    private boolean visible(Map<String,Object> r,Set<String> allowed) {return r.get("siteId")==null||allowed.contains(r.get("siteId").toString());}
    static void validate(WorkInput input) {
        if(input==null||!Set.of("FIELD","GENERAL").contains(input.kind()==null?"":input.kind()))throw new BadRequestException("업무 구분을 선택해주세요.");
        text(input.title(),200,"제목");text(input.body(),100000,"내용");
        if(input.workDate()==null)throw new BadRequestException("작업일을 선택해주세요.");
        if(!Set.of("IN_PROGRESS","COMPLETED","REVISIT").contains(input.status()==null?"":input.status()))throw new BadRequestException("상태를 선택해주세요.");
        if("FIELD".equals(input.kind())&&(input.siteId()==null||input.siteId().isBlank()))throw new BadRequestException("현장 서비스의 병원을 선택해주세요.");
        if("FIELD".equals(input.kind())&&!Set.of("REPAIR","PM","ACR","CALL","COLDHEAD","INSTALL","ETC").contains(input.serviceType()==null?"":input.serviceType()))throw new BadRequestException("서비스 유형을 선택해주세요.");
    }
    private static void text(String s,int max,String label){if(s==null||s.isBlank()||s.length()>max)throw new BadRequestException(label+"을 확인해주세요.");}
    private String site(CurrentUser u,String id){if(id==null||id.isBlank())return null;String normalized=SiteService.normalizeSiteId(id);users.requireSiteAccess(u,normalized);return normalized;}
    @PostMapping("/records") @Transactional
    public Map<String,Object> create(@RequestBody WorkInput input,Authentication auth) {
        var u=users.require(auth);validate(input);String sid="FIELD".equals(input.kind())?site(u,input.siteId()):null;
        db.update("INSERT INTO workspace_record(company_id,author_id,site_id,kind,service_type,title,body,work_date,status,details_json) VALUES(?,?,?,?,?,?,?,?,?,?)",u.companyId(),u.id(),sid,input.kind(),sid==null?null:input.serviceType(),input.title().trim(),input.body(),input.workDate(),input.status(),detailsJson(input));
        long id=db.queryForObject("SELECT LAST_INSERT_ID()",Long.class);
        new WorkspacePhotos(db,users).attach(u,id,input.photoIds());
        syncPreparation(u,id,sid,input.details());
        return Map.of("id",id);
    }
    private void syncPreparation(CurrentUser u,long id,String sid,Map<String,Object> details){
        if(details==null||!details.containsKey("prepItems"))return;
        // Preserve checked items; replace only this record's still-open preparation list.
        Object raw=details.get("prepItems");String text=raw instanceof String value?value:"";
        if(text.length()>10000)throw new BadRequestException("준비물은 10,000자 이내로 입력해주세요.");
        java.util.Set<String> lines=new java.util.LinkedHashSet<>();
        for(String line:text.split("\\R")){line=line.trim();if(line.isEmpty())continue;if(line.length()>1000)throw new BadRequestException("준비물 한 항목은 1,000자 이내로 입력해주세요.");lines.add(line);}
        for(var previous:db.queryForList("SELECT id,content,done FROM workspace_preparation WHERE record_id=? AND company_id=?",id,u.companyId())){
            if(!lines.contains(previous.get("content"))&&!Boolean.TRUE.equals(previous.get("done")))db.update("DELETE FROM workspace_preparation WHERE id=? AND company_id=? AND done=FALSE",previous.get("id"),u.companyId());
        }
        for(String line:lines)db.update("INSERT INTO workspace_preparation(company_id,author_id,site_id,record_id,content) SELECT ?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM workspace_preparation WHERE record_id=? AND company_id=? AND content=?)",u.companyId(),u.id(),sid,id,line,id,u.companyId(),line);
    }
    private void requireRecordOwner(long id,CurrentUser u) {
        var rows=db.queryForList("SELECT author_id,site_id siteId FROM workspace_record WHERE id=? AND company_id=? AND deleted_at IS NULL FOR UPDATE",id,u.companyId());
        if(rows.isEmpty())throw new NotFoundException("업무 기록을 찾을 수 없습니다.");
        var r=rows.get(0);if(r.get("siteId")!=null)users.requireSiteAccess(u,r.get("siteId").toString());
        if(!u.isAdmin()&&((Number)r.get("author_id")).longValue()!=u.id())throw new ForbiddenException("작성한 업무만 수정할 수 있습니다.");
    }
    @PutMapping("/records/{id}") @Transactional
    public Map<String,Boolean> update(@PathVariable long id,@RequestBody WorkInput input,Authentication auth){
        var u=users.require(auth);requireRecordOwner(id,u);validate(input);String sid="FIELD".equals(input.kind())?site(u,input.siteId()):null;
        db.update("UPDATE workspace_record SET site_id=?,kind=?,service_type=?,title=?,body=?,work_date=?,status=?,details_json=? WHERE id=? AND company_id=? AND deleted_at IS NULL",sid,input.kind(),sid==null?null:input.serviceType(),input.title().trim(),input.body(),input.workDate(),input.status(),detailsJson(input),id,u.companyId());new WorkspacePhotos(db,users).attach(u,id,input.photoIds());syncPreparation(u,id,sid,input.details());return Map.of("saved",true);
    }
    @DeleteMapping("/records/{id}") @Transactional
    public Map<String,Boolean> delete(@PathVariable long id,Authentication auth){var u=users.require(auth);requireRecordOwner(id,u);db.update("DELETE FROM workspace_preparation WHERE record_id=? AND company_id=? AND done=FALSE",id,u.companyId());db.update("UPDATE workspace_record SET deleted_at=CURRENT_TIMESTAMP(6) WHERE id=? AND company_id=?",id,u.companyId());return Map.of("deleted",true);}
    @GetMapping("/schedules")
    public List<Map<String,Object>> schedules(Authentication auth){var u=users.require(auth);var allowed=users.allowedSiteIds(u);return db.queryForList("""
        SELECT w.id,w.author_id authorId,u.name authorName,w.site_id siteId,s.name siteName,w.title,w.body,DATE_FORMAT(w.start_at,'%Y-%m-%dT%H:%i:%s') startAt,DATE_FORMAT(w.end_at,'%Y-%m-%dT%H:%i:%s') endAt
        FROM workspace_schedule w JOIN app_user u ON u.id=w.author_id LEFT JOIN site s ON s.site=w.site_id
        WHERE w.company_id=? AND w.deleted_at IS NULL ORDER BY w.start_at,w.id LIMIT 1000
        """,u.companyId()).stream().filter(r->visible(r,allowed)).toList();}
    @PostMapping("/schedules") @Transactional
    public Map<String,Object> schedule(@RequestBody ScheduleInput input,Authentication auth){
        var u=users.require(auth);text(input.title(),200,"제목");if(input.body()!=null&&input.body().length()>10000)throw new BadRequestException("내용이 너무 깁니다.");
        if(input.startAt()==null||input.endAt()==null||input.endAt().isBefore(input.startAt()))throw new BadRequestException("일정의 시작·종료 시간을 확인해주세요.");
        String sid=site(u,input.siteId());db.update("INSERT INTO workspace_schedule(company_id,author_id,site_id,title,body,start_at,end_at) VALUES(?,?,?,?,?,?,?)",u.companyId(),u.id(),sid,input.title().trim(),input.body()==null?"":input.body(),input.startAt(),input.endAt());return Map.of("id",db.queryForObject("SELECT LAST_INSERT_ID()",Long.class));
    }
    @DeleteMapping("/schedules/{id}")
    public Map<String,Boolean> deleteSchedule(@PathVariable long id,Authentication auth){var u=users.require(auth);var rows=db.queryForList("SELECT author_id,site_id siteId FROM workspace_schedule WHERE id=? AND company_id=? AND deleted_at IS NULL",id,u.companyId());if(rows.isEmpty())throw new NotFoundException("일정을 찾을 수 없습니다.");var r=rows.get(0);if(r.get("siteId")!=null)users.requireSiteAccess(u,r.get("siteId").toString());if(!u.isAdmin()&&((Number)r.get("author_id")).longValue()!=u.id())throw new ForbiddenException("작성한 일정만 삭제할 수 있습니다.");db.update("UPDATE workspace_schedule SET deleted_at=CURRENT_TIMESTAMP(6) WHERE id=? AND company_id=?",id,u.companyId());return Map.of("deleted",true);}
}
