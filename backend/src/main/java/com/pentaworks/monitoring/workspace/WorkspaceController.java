package com.pentaworks.monitoring.workspace;

import com.pentaworks.monitoring.auth.CurrentUserService;
import com.pentaworks.monitoring.auth.CurrentUserService.CurrentUser;
import com.pentaworks.monitoring.common.BadRequestException;
import com.pentaworks.monitoring.common.ConflictException;
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
    private final org.springframework.context.ApplicationEventPublisher changes;
    public WorkspaceController(JdbcTemplate db, CurrentUserService users, org.springframework.context.ApplicationEventPublisher changes) {this.db=db;this.users=users;this.changes=changes;}
    private void changed(long companyId) { changes.publishEvent(new com.pentaworks.monitoring.calendar.CalendarChanged(companyId)); }
    public record WorkInput(String kind,String siteId,String serviceType,String title,String body,LocalDate workDate,String status,Map<String,Object> details,List<Long> photoIds,Long revision) {
        public WorkInput(String kind,String siteId,String serviceType,String title,String body,LocalDate workDate,String status) {this(kind,siteId,serviceType,title,body,workDate,status,null,null,null);}
    }
    private final ObjectMapper mapper=new ObjectMapper();
    private String detailsJson(WorkInput input) {
        try {String json=mapper.writeValueAsString(input.details()==null?Map.of():input.details());if(json.length()>250000)throw new BadRequestException("점검 항목의 내용이 너무 큽니다.");return json;}
        catch(JsonProcessingException e){throw new BadRequestException("작업 상세를 확인해주세요.");}
    }
    public record ScheduleInput(String siteId,String title,String body,LocalDateTime startAt,LocalDateTime endAt,String targetKind,String personalKind,String serviceType,Long revision) {}
    private static final String RECORDS="""
        SELECT w.id,w.revision,w.author_id authorId,u.name authorName,w.site_id siteId,COALESCE(h.name,s.name) siteName,
               w.engineer_name engineerName,w.counts_as_pm countsAsPm,w.acr_kind acrKind,w.schedule_id scheduleId,w.source_id sourceId,
               (SELECT DATE_FORMAT(sc.start_at,'%Y-%m-%d') FROM workspace_schedule sc WHERE sc.id=w.schedule_id AND sc.company_id=w.company_id) scheduleDate,
               w.kind,w.service_type serviceType,w.title,w.body,DATE_FORMAT(w.work_date,'%Y-%m-%d') workDate,w.status,w.details_json detailsJson,w.updated_at updatedAt,
               EXISTS(SELECT 1 FROM workspace_asset_history h WHERE h.record_id=w.id AND h.change_kind IN ('REGISTER','UPDATE')) assetChange
        FROM workspace_record w JOIN app_user u ON u.id=w.author_id LEFT JOIN site s ON s.site=w.site_id LEFT JOIN workspace_hospital h ON h.company_id=w.company_id AND h.site_id=w.site_id
        WHERE w.company_id=? AND w.deleted_at IS NULL ORDER BY w.work_date DESC,w.id DESC
        """;
    @GetMapping("/hospitals")
    public List<Map<String,Object>> hospitals(Authentication auth) {
        var u=users.require(auth);var allowed=users.allowedSiteIds(u);
        var equipment=new java.util.HashMap<String,List<String>>();
        for(var asset:db.queryForList("SELECT site_id,model,name,metadata_json FROM workspace_asset WHERE company_id=? AND asset_type='MRI' AND status='ACTIVE' ORDER BY id",u.companyId())) {
            String sid=asset.get("site_id").toString();if(!allowed.contains(sid))continue;
            var labels=new java.util.ArrayList<String>();
            String model=java.util.Objects.toString(asset.get("model"),"").trim();
            if(!model.isEmpty())labels.add(model);else labels.add(asset.get("name").toString());
            try {
                var meta=mapper.readTree(java.util.Objects.toString(asset.get("metadata_json"),"{}"));
                String vendor=meta.path("manufacturer").asText("").trim();
                if(!vendor.isEmpty()&&!model.toLowerCase(java.util.Locale.ROOT).contains(vendor.toLowerCase(java.util.Locale.ROOT)))labels.add(0,vendor);
                String tesla=meta.path("magneticFieldTesla").asText("").trim();
                if(!tesla.isEmpty()&&!model.toLowerCase(java.util.Locale.ROOT).contains(tesla.toLowerCase(java.util.Locale.ROOT)+"t"))labels.add(tesla+"T");
            }catch(JsonProcessingException ignored) { /* Existing model/serial fields remain available. */ }
            equipment.computeIfAbsent(sid,k->new java.util.ArrayList<>()).add(String.join(" · ",labels));
        }
        var snapshots=new java.util.HashMap<String,Map<String,Object>>();
        for(var row:db.queryForList("SELECT site_id,JSON_UNQUOTE(JSON_EXTRACT(response_json,'$.site.address')) address,JSON_EXTRACT(response_json,'$.equipment') equipment FROM workspace_office_snapshot WHERE company_id=?",u.companyId())) {
            String sid=row.get("site_id").toString();if(allowed.contains(sid))snapshots.put(sid,row);
        }
        var result=new java.util.ArrayList<Map<String,Object>>();
        for(var site:db.queryForList("SELECT s.site siteId,COALESCE(h.name,s.name) name,p.address,h.id hospitalId,COALESCE(h.monitoring_site_id,IF(h.id IS NULL,s.site,NULL)) monitoringSiteId FROM site s JOIN company_site cs ON cs.site_id=s.site LEFT JOIN site_profile p ON p.site_id=s.site LEFT JOIN workspace_hospital h ON h.company_id=cs.company_id AND h.site_id=s.site WHERE cs.company_id=? AND NOT EXISTS(SELECT 1 FROM workspace_hospital connected WHERE connected.company_id=cs.company_id AND connected.monitoring_site_id=s.site AND connected.site_id<>s.site) ORDER BY s.name,s.site",u.companyId())) {
            String sid=site.get("siteId").toString();if(!allowed.contains(sid))continue;
            var snapshot=snapshots.get(sid);
            String address=java.util.Objects.toString(site.get("address"),"").trim();
            if(address.isEmpty()&&snapshot!=null)address=java.util.Objects.toString(snapshot.get("address"),"").trim();
            if("null".equals(address))address="";
            List<String> models=equipment.get(sid);
            if(models==null&&snapshot!=null) {
                models=new java.util.ArrayList<>();
                try { for(var item:mapper.readTree(java.util.Objects.toString(snapshot.get("equipment"),"[]"))) {
                    String model=item.path("model").asText("");if(!model.isBlank())models.add(model);
                }}catch(JsonProcessingException ignored) { /* Unmigrated metadata can be absent. */ }
            }
            var row=new java.util.LinkedHashMap<String,Object>();row.put("siteDb",sid);row.put("name",site.get("name"));row.put("address",address);row.put("hospitalId",site.get("hospitalId"));row.put("monitoringConnected",site.get("monitoringSiteId")!=null);row.put("equipment",models==null?List.of():models);result.add(row);
        }
        return result;
    }
    @GetMapping("/records")
    public List<Map<String,Object>> records(Authentication auth) {
        var u=users.require(auth);var allowed=users.allowedSiteIds(u);
        return db.queryForList(RECORDS,u.companyId()).stream().filter(r->visible(r,allowed)).toList();
    }
    @GetMapping("/records/{id}")
    public Map<String,Object> record(@PathVariable long id,Authentication auth) {
        var u=users.require(auth);var rows=db.queryForList(RECORDS.replace("WHERE w.company_id=?", "WHERE w.id=? AND w.company_id=?"),id,u.companyId());
        if(rows.isEmpty()||!visible(rows.get(0),users.allowedSiteIds(u)))throw new NotFoundException("업무기록을 찾을 수 없습니다.");return rows.get(0);
    }
    @GetMapping("/records/search")
    public Map<String,Object> searchRecords(@RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="20") int size,@RequestParam(defaultValue="") String query,@RequestParam(defaultValue="ALL") String kind,@RequestParam(defaultValue="false") boolean openOnly,Authentication auth) {
        var u=users.require(auth);var allowed=users.allowedSiteIds(u);size=Math.max(1,Math.min(size,100));page=Math.max(1,page);
        var args=new java.util.ArrayList<Object>();args.add(u.companyId());
        String where="WHERE w.company_id=? AND w.deleted_at IS NULL";
        where += " AND (w.site_id IS NULL";
        if(!allowed.isEmpty()){where+=" OR w.site_id IN ("+String.join(",",java.util.Collections.nCopies(allowed.size(),"?"))+")";args.addAll(allowed);}where+=")";
        if(!"ALL".equals(kind)){where+=" AND w.kind=?";args.add(kind);}
        if(openOnly)where+=" AND w.status<>'COMPLETED'";
        if(!query.isBlank()){if(query.length()>200)throw new BadRequestException("검색어는 200자 이내로 입력해주세요.");where+=" AND (LOCATE(?,w.title)>0 OR LOCATE(?,w.body)>0 OR LOCATE(?,COALESCE(h.name,s.name))>0)";for(int i=0;i<3;i++)args.add(query.trim());}
        String from=RECORDS.substring(RECORDS.indexOf("FROM workspace_record"),RECORDS.indexOf("WHERE w.company_id"));
        Long total=db.queryForObject("SELECT COUNT(*) "+from+where,Long.class,args.toArray());
        String projection=RECORDS.substring(0,RECORDS.indexOf("FROM workspace_record"));
        args.add(size);args.add((long)(page-1)*size);
        return Map.of("records",db.queryForList(projection+from+where+" ORDER BY w.work_date DESC,w.id DESC LIMIT ? OFFSET ?",args.toArray()),"total",total==null?0:total,"page",page);
    }
    private void snapshot(CurrentUser u,String type,long id,String action) {
        String table=type.equals("RECORD")?"workspace_record":"workspace_schedule";
        var row=db.queryForMap("SELECT * FROM "+table+" WHERE id=? AND company_id=?",id,u.companyId());
        // Explicit serializable text preserves dates and details without embedding photo bytes.
        var safe=new java.util.LinkedHashMap<String,Object>();row.forEach((k,v)->safe.put(k,v==null?null:v.toString()));
        try {db.update("INSERT INTO workspace_change_history(company_id,resource_type,resource_id,revision,action,actor_id,snapshot_json) VALUES(?,?,?,?,?,?,?)",u.companyId(),type,id,row.get("revision"),action,u.id(),mapper.writeValueAsString(safe));}
        catch(JsonProcessingException e){throw new IllegalStateException("변경 이력을 저장하지 못했습니다.",e);}
    }
    @GetMapping("/records/{id}/history")
    public List<Map<String,Object>> recordHistory(@PathVariable long id,Authentication auth){record(id,auth);var u=users.require(auth);return db.queryForList("SELECT h.id,h.revision,h.action,u.name actorName,h.created_at createdAt,h.snapshot_json snapshotJson FROM workspace_change_history h LEFT JOIN app_user u ON u.id=h.actor_id WHERE h.company_id=? AND h.resource_type='RECORD' AND h.resource_id=? ORDER BY h.id DESC",u.companyId(),id);}
    static void checkRevision(Long expected,Object current) {if(expected==null||!(current instanceof Number n)||expected.longValue()!=n.longValue())throw new ConflictException("다른 사람이 수정했거나 최신 버전이 아닙니다. 작성 내용을 보관한 뒤 최신 내용을 다시 불러와주세요.");}
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
        syncRecordFields(u,id,sid,input);syncPreparation(u,id,sid,input.details());new WorkspaceAssets(db,users).sync(u,id,sid,input.details());
        snapshot(u,"RECORD",id,"CREATE");changed(u.companyId());
        return Map.of("id",id);
    }
    private void syncRecordFields(CurrentUser u,long id,String sid,WorkInput input) {
        Map<String,Object> details=input.details()==null?Map.of():input.details();
        if(details.containsKey("engineer")) {
            Object value=details.get("engineer");
            if(!(value instanceof String name)||name.length()>200)throw new BadRequestException("담당자는 200자 이내로 입력해주세요.");
            db.update("UPDATE workspace_record SET engineer_name=? WHERE id=? AND company_id=?",name.trim(),id,u.companyId());
        }
        if(details.containsKey("countsAsPm")) {
            if(!(details.get("countsAsPm") instanceof Boolean))throw new BadRequestException("PM 점검 포함 여부를 확인해주세요.");
            db.update("UPDATE workspace_record SET counts_as_pm=? WHERE id=? AND company_id=?",details.get("countsAsPm"),id,u.companyId());
        }
        if(details.containsKey("acrKind")) {
            Object value=details.get("acrKind");
            if(!(value instanceof String kind)||!Set.of("","doc","full","pretest").contains(kind))throw new BadRequestException("ACR 구분을 확인해주세요.");
            db.update("UPDATE workspace_record SET acr_kind=? WHERE id=? AND company_id=?",value,id,u.companyId());
        }
        // A schedule can have multiple work records; never infer linkage by date/title.
        if(details.containsKey("scheduleId")) {
            Object raw=details.get("scheduleId");Long schedule=null;
            if(raw!=null) {
                if(!(raw instanceof Number n)||n.longValue()<=0||n.doubleValue()!=n.longValue())throw new BadRequestException("연결할 일정을 확인해주세요.");
                schedule=n.longValue();
                var rows=db.queryForList("SELECT site_id FROM workspace_schedule WHERE id=? AND company_id=? AND (deleted_at IS NULL OR id=(SELECT schedule_id FROM workspace_record WHERE id=? AND company_id=?)) FOR UPDATE",schedule,u.companyId(),id,u.companyId());
                if(rows.isEmpty()||!java.util.Objects.equals(sid,rows.get(0).get("site_id")))throw new BadRequestException("같은 병원의 일정만 연결할 수 있습니다.");
                if(sid!=null)users.requireSiteAccess(u,sid);
            }
            db.update("UPDATE workspace_record SET schedule_id=? WHERE id=? AND company_id=?",schedule,id,u.companyId());
        } else {
            // Older clients must not leave a hospital-changing edit attached to another hospital.
            if(Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM workspace_record r JOIN workspace_schedule s ON s.id=r.schedule_id AND s.company_id=r.company_id WHERE r.id=? AND r.company_id=? AND NOT(s.site_id <=> ?))",Boolean.class,id,u.companyId(),sid)))throw new BadRequestException("연결된 일정과 같은 병원을 선택해주세요.");
        }
    }
    private void syncPreparation(CurrentUser u,long id,String sid,Map<String,Object> details){
        if(details==null||!details.containsKey("prepItems"))return;
        // Preserve checked items; replace only this record's still-open preparation list.
        Object raw=details.get("prepItems");String text=raw instanceof String value?value:"";
        if(text.length()>10000)throw new BadRequestException("방문 전 확인사항은 10,000자 이내로 입력해주세요.");
        java.util.Set<String> lines=new java.util.LinkedHashSet<>();
        for(String line:text.split("\\R")){line=line.trim();if(line.isEmpty())continue;if(line.length()>1000)throw new BadRequestException("방문 전 확인사항 한 항목은 1,000자 이내로 입력해주세요.");lines.add(line);}
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
    public Map<String,Object> update(@PathVariable long id,@RequestBody WorkInput input,Authentication auth){
        var u=users.require(auth);requireRecordOwner(id,u);checkRevision(input.revision(),db.queryForObject("SELECT revision FROM workspace_record WHERE id=? AND company_id=?",Long.class,id,u.companyId()));snapshot(u,"RECORD",id,"BEFORE");validate(input);String sid="FIELD".equals(input.kind())?site(u,input.siteId()):null;
        db.update("UPDATE workspace_record SET revision=revision+1,site_id=?,kind=?,service_type=?,title=?,body=?,work_date=?,status=?,details_json=JSON_MERGE_PATCH(COALESCE(details_json,JSON_OBJECT()),?) WHERE id=? AND company_id=? AND deleted_at IS NULL",sid,input.kind(),sid==null?null:input.serviceType(),input.title().trim(),input.body(),input.workDate(),input.status(),detailsJson(input),id,u.companyId());new WorkspacePhotos(db,users).attach(u,id,input.photoIds());syncRecordFields(u,id,sid,input);syncPreparation(u,id,sid,input.details());new WorkspaceAssets(db,users).sync(u,id,sid,input.details());snapshot(u,"RECORD",id,"UPDATE");changed(u.companyId());return Map.of("saved",true,"revision",input.revision()+1);
    }
    @DeleteMapping("/records/{id}") @Transactional
    public Map<String,Boolean> delete(@PathVariable long id,Authentication auth){var u=users.require(auth);requireRecordOwner(id,u);if(Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM workspace_asset_history WHERE record_id=? AND change_kind IN ('REGISTER','UPDATE'))",Boolean.class,id)))throw new BadRequestException("장비·부품 변경 이력은 삭제할 수 없습니다. 정보 변경에서 정정 내용을 남겨주세요.");snapshot(u,"RECORD",id,"DELETE");db.update("DELETE FROM workspace_preparation WHERE record_id=? AND company_id=? AND done=FALSE",id,u.companyId());db.update("UPDATE workspace_record SET deleted_at=CURRENT_TIMESTAMP(6) WHERE id=? AND company_id=?",id,u.companyId());changed(u.companyId());return Map.of("deleted",true);}
    @GetMapping("/schedules")
    public List<Map<String,Object>> schedules(@RequestParam(required=false) @org.springframework.format.annotation.DateTimeFormat(iso=org.springframework.format.annotation.DateTimeFormat.ISO.DATE) LocalDate from,@RequestParam(required=false) @org.springframework.format.annotation.DateTimeFormat(iso=org.springframework.format.annotation.DateTimeFormat.ISO.DATE) LocalDate to,Authentication auth){var u=users.require(auth);var allowed=users.allowedSiteIds(u);return db.queryForList("""
        SELECT w.id,w.revision,w.author_id authorId,u.name authorName,w.site_id siteId,COALESCE(h.name,s.name) siteName,w.target_kind targetKind,w.personal_kind personalKind,w.service_type serviceType,w.title,w.body,DATE_FORMAT(w.start_at,'%Y-%m-%dT%H:%i:%s') startAt,DATE_FORMAT(w.end_at,'%Y-%m-%dT%H:%i:%s') endAt
        FROM workspace_schedule w JOIN app_user u ON u.id=w.author_id LEFT JOIN site s ON s.site=w.site_id LEFT JOIN workspace_hospital h ON h.company_id=w.company_id AND h.site_id=w.site_id
        WHERE w.company_id=? AND w.deleted_at IS NULL AND (? IS NULL OR w.end_at>=?) AND (? IS NULL OR w.start_at<?) ORDER BY w.start_at,w.id
        """,u.companyId(),from,from==null?null:from.atStartOfDay(),to,to==null?null:to.plusDays(1).atStartOfDay()).stream().filter(r->visible(r,allowed)).toList();}
    @PostMapping("/schedules") @Transactional
    public Map<String,Object> schedule(@RequestBody ScheduleInput input,Authentication auth){
        var u=users.require(auth);text(input.title(),200,"제목");if(input.body()!=null&&input.body().length()>10000)throw new BadRequestException("내용이 너무 깁니다.");
        if(input.startAt()==null||input.endAt()==null||input.endAt().isBefore(input.startAt()))throw new BadRequestException("일정의 시작·종료 시간을 확인해주세요.");
        String sid=site(u,input.siteId());
        String target=input.targetKind()==null?(sid==null?"GENERAL":"HOSPITAL"):input.targetKind();
        if(!List.of("HOSPITAL","GENERAL").contains(target))throw new BadRequestException("일정 대상을 확인해주세요.");
        String personal="GENERAL".equals(target)?input.personalKind():null;
        String service="HOSPITAL".equals(target)?input.serviceType():null;
        if("HOSPITAL".equals(target)&&sid==null)throw new BadRequestException("병원을 선택해주세요.");
        if("GENERAL".equals(target)&&sid!=null)throw new BadRequestException("병원 외 일정에는 병원을 지정할 수 없습니다.");
        if(personal!=null&&!List.of("office","edu","leave","annual","etc").contains(personal))throw new BadRequestException("병원 외 일정 분류를 확인해주세요.");
        if(service!=null&&!List.of("PM","REPAIR","COLDHEAD","ACR","CALL","INSTALL","ETC").contains(service))throw new BadRequestException("서비스 유형을 확인해주세요.");
        db.update("INSERT INTO workspace_schedule(company_id,author_id,site_id,title,body,start_at,end_at,target_kind,personal_kind,service_type) VALUES(?,?,?,?,?,?,?,?,?,?)",u.companyId(),u.id(),sid,input.title().trim(),input.body()==null?"":input.body(),input.startAt(),input.endAt(),target,personal,service);changed(u.companyId());return Map.of("id",db.queryForObject("SELECT LAST_INSERT_ID()",Long.class));
    }
    @PutMapping("/schedules/{id}") @Transactional
    public Map<String,Boolean> updateSchedule(@PathVariable long id,@RequestBody ScheduleInput input,Authentication auth){
        var u=users.require(auth);text(input.title(),200,"제목");if(input.body()!=null&&input.body().length()>10000)throw new BadRequestException("내용이 너무 깁니다.");
        if(input.startAt()==null||input.endAt()==null||input.endAt().isBefore(input.startAt()))throw new BadRequestException("일정의 시작·종료 시간을 확인해주세요.");
        String sid=site(u,input.siteId());
        String target=input.targetKind()==null?(sid==null?"GENERAL":"HOSPITAL"):input.targetKind();
        if(!List.of("HOSPITAL","GENERAL").contains(target))throw new BadRequestException("일정 대상을 확인해주세요.");
        String personal="GENERAL".equals(target)?input.personalKind():null;
        String service="HOSPITAL".equals(target)?input.serviceType():null;
        if("HOSPITAL".equals(target)&&sid==null)throw new BadRequestException("병원을 선택해주세요.");
        if("GENERAL".equals(target)&&sid!=null)throw new BadRequestException("병원 외 일정에는 병원을 지정할 수 없습니다.");
        if(personal!=null&&!List.of("office","edu","leave","annual","etc").contains(personal))throw new BadRequestException("병원 외 일정 분류를 확인해주세요.");
        if(service!=null&&!List.of("PM","REPAIR","COLDHEAD","ACR","CALL","INSTALL","ETC").contains(service))throw new BadRequestException("서비스 유형을 확인해주세요.");
        var rows=db.queryForList("SELECT author_id,site_id,revision FROM workspace_schedule WHERE id=? AND company_id=? AND deleted_at IS NULL FOR UPDATE",id,u.companyId());
        if(rows.isEmpty())throw new NotFoundException("일정을 찾을 수 없습니다.");var row=rows.get(0);
        if(row.get("site_id")!=null)users.requireSiteAccess(u,row.get("site_id").toString());
        if(!u.isAdmin()&&((Number)row.get("author_id")).longValue()!=u.id())throw new ForbiddenException("작성한 일정만 수정할 수 있습니다.");
        checkRevision(input.revision(),row.get("revision"));
        if(!java.util.Objects.equals(sid,row.get("site_id"))&&Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM workspace_record WHERE company_id=? AND schedule_id=? AND deleted_at IS NULL)",Boolean.class,u.companyId(),id)))throw new BadRequestException("연결된 업무기록이 있어 병원은 변경할 수 없습니다. 날짜와 내용은 수정할 수 있습니다.");
        snapshot(u,"SCHEDULE",id,"BEFORE");
        db.update("UPDATE workspace_schedule SET site_id=?,title=?,body=?,start_at=?,end_at=?,target_kind=?,personal_kind=?,service_type=?,revision=revision+1 WHERE id=? AND company_id=?",sid,input.title().trim(),input.body()==null?"":input.body(),input.startAt(),input.endAt(),target,personal,service,id,u.companyId());
        snapshot(u,"SCHEDULE",id,"UPDATE");changed(u.companyId());return Map.of("saved",true);
    }
    @DeleteMapping("/schedules/{id}") @Transactional
    public Map<String,Boolean> deleteSchedule(@PathVariable long id,Authentication auth){var u=users.require(auth);var rows=db.queryForList("SELECT author_id,site_id siteId FROM workspace_schedule WHERE id=? AND company_id=? AND deleted_at IS NULL",id,u.companyId());if(rows.isEmpty())throw new NotFoundException("일정을 찾을 수 없습니다.");var r=rows.get(0);if(r.get("siteId")!=null)users.requireSiteAccess(u,r.get("siteId").toString());if(!u.isAdmin()&&((Number)r.get("author_id")).longValue()!=u.id())throw new ForbiddenException("작성한 일정만 삭제할 수 있습니다.");db.update("UPDATE workspace_schedule SET deleted_at=CURRENT_TIMESTAMP(6) WHERE id=? AND company_id=?",id,u.companyId());changed(u.companyId());return Map.of("deleted",true);}
}
