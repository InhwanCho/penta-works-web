package com.pentaworks.monitoring.workspace;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pentaworks.monitoring.auth.CurrentUserService;
import com.pentaworks.monitoring.auth.CurrentUserService.CurrentUser;
import com.pentaworks.monitoring.common.BadRequestException;
import com.pentaworks.monitoring.common.NotFoundException;
import com.pentaworks.monitoring.site.SiteService;
import java.time.LocalDate;
import java.util.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/workspace/sites/{siteId}/assets")
@ConditionalOnProperty(name="app.workspace.enabled",havingValue="true")
public class WorkspaceAssets {
    private final JdbcTemplate db;
    private final CurrentUserService users;
    private final ObjectMapper mapper = new ObjectMapper();
    public WorkspaceAssets(JdbcTemplate db, CurrentUserService users) { this.db=db; this.users=users; }
    public record AssetInput(String assetType,String name,String model,String version,String serialNumber,
        LocalDate installedAt,String status,String notes,LocalDate workDate,String changeNote,Integer revision) {}
    private static final String COLUMNS="id,asset_type assetType,name,model,version,serial_number serialNumber,DATE_FORMAT(installed_at,'%Y-%m-%d') installedAt,status,notes,revision";
    private String site(CurrentUser u,String id) {var sid=SiteService.normalizeSiteId(id);users.requireSiteAccess(u,sid);return sid;}
    @GetMapping
    public Map<String,Object> list(@PathVariable String siteId,Authentication auth) {
        var u=users.require(auth);var sid=site(u,siteId);
        var assets=db.queryForList("SELECT "+COLUMNS+" FROM workspace_asset WHERE company_id=? AND site_id=? ORDER BY asset_type,id",u.companyId(),sid);
        var history=db.queryForList("""
            SELECT h.id,h.asset_id assetId,h.record_id recordId,h.snapshot_json snapshotJson,h.change_kind changeKind,
             w.title,w.body,DATE_FORMAT(w.work_date,'%Y-%m-%d') workDate,w.status,u.name authorName
            FROM workspace_asset_history h JOIN workspace_asset a ON a.id=h.asset_id
             JOIN workspace_record w ON w.id=h.record_id JOIN app_user u ON u.id=w.author_id
            WHERE a.company_id=? AND a.site_id=? AND w.company_id=a.company_id AND w.site_id=a.site_id AND w.deleted_at IS NULL
            ORDER BY w.work_date DESC,h.id DESC
            """,u.companyId(),sid);
        return Map.of("assets",assets,"history",history);
    }
    static void validate(AssetInput i) {
        if(i==null || !Set.of("MRI","CHILLER","COLDHEAD","OTHER").contains(Objects.toString(i.assetType(),"")))throw new BadRequestException("장비·부품 종류를 선택해주세요.");
        if(i.name()==null||i.name().isBlank()||i.name().length()>200)throw new BadRequestException("이름을 200자 이내로 입력해주세요.");
        if(!Set.of("ACTIVE","REPLACED","REMOVED").contains(Objects.toString(i.status(),"")))throw new BadRequestException("사용 상태를 확인해주세요.");
        if(i.workDate()==null||i.changeNote()==null||i.changeNote().isBlank()||i.changeNote().length()>10000)throw new BadRequestException("기록일과 변경·정비 내용을 입력해주세요.");
        if(value(i.model()).length()>200||value(i.version()).length()>100||value(i.serialNumber()).length()>200||value(i.notes()).length()>10000)throw new BadRequestException("입력 길이를 확인해주세요.");
    }
    private static String value(String s){return s==null?"":s.trim();}
    private String json(Object o){try{return mapper.writeValueAsString(o);}catch(JsonProcessingException e){throw new BadRequestException("장비 정보를 확인해주세요.");}}
    @PostMapping @Transactional
    public Map<String,Object> create(@PathVariable String siteId,@RequestBody AssetInput input,Authentication auth){return save(siteId,null,input,auth);}
    @PutMapping("/{id}") @Transactional
    public Map<String,Object> update(@PathVariable String siteId,@PathVariable long id,@RequestBody AssetInput input,Authentication auth){return save(siteId,id,input,auth);}
    private Map<String,Object> save(String siteId,Long id,AssetInput i,Authentication auth) {
        var u=users.require(auth);var sid=site(u,siteId);validate(i);
        Map<String,Object> before=null;
        if(id!=null){
            var rows=db.queryForList("SELECT "+COLUMNS+" FROM workspace_asset WHERE id=? AND company_id=? AND site_id=? FOR UPDATE",id,u.companyId(),sid);
            if(rows.isEmpty())throw new NotFoundException("장비·부품을 찾을 수 없습니다.");
            before=rows.get(0);
            if(i.revision()==null||i.revision().intValue()!=((Number)before.get("revision")).intValue())throw new BadRequestException("다른 담당자가 변경했습니다. 새로고침 후 다시 작성해주세요.");
            if(!i.assetType().equals(before.get("assetType")))throw new BadRequestException("등록한 장비·부품 종류는 변경할 수 없습니다.");
        }
        if(id==null){
            db.update("INSERT INTO workspace_asset(company_id,site_id,asset_type,name,model,version,serial_number,installed_at,status,notes) VALUES(?,?,?,?,?,?,?,?,?,?)",u.companyId(),sid,i.assetType(),i.name().trim(),value(i.model()),value(i.version()),value(i.serialNumber()),i.installedAt(),i.status(),value(i.notes()));
            id=db.queryForObject("SELECT LAST_INSERT_ID()",Long.class);
        }else db.update("UPDATE workspace_asset SET name=?,model=?,version=?,serial_number=?,installed_at=?,status=?,notes=?,revision=revision+1 WHERE id=? AND company_id=? AND site_id=?",i.name().trim(),value(i.model()),value(i.version()),value(i.serialNumber()),i.installedAt(),i.status(),value(i.notes()),id,u.companyId(),sid);
        var after=db.queryForMap("SELECT "+COLUMNS+" FROM workspace_asset WHERE id=? AND company_id=?",id,u.companyId());
        var snapshot=new LinkedHashMap<String,Object>();snapshot.put("before",before);snapshot.put("after",after);
        var details=new LinkedHashMap<String,Object>();details.put("assetIds",List.of(id));details.put("engineer",u.name());details.put("model",value(i.model()));
        String title=i.name().trim()+ (before==null?" 등록":" 정보 변경·정비");
        db.update("INSERT INTO workspace_record(company_id,author_id,site_id,kind,service_type,title,body,work_date,status,details_json) VALUES(?,?,?,'FIELD','ETC',?,?,?,'COMPLETED',?)",u.companyId(),u.id(),sid,title,i.changeNote().trim(),i.workDate(),json(details));
        long recordId=db.queryForObject("SELECT LAST_INSERT_ID()",Long.class);
        db.update("INSERT INTO workspace_asset_history(asset_id,record_id,snapshot_json,change_kind) VALUES(?,?,?,?)",id,recordId,json(snapshot),before==null?"REGISTER":"UPDATE");
        return Map.of("id",id,"recordId",recordId);
    }
    static List<Long> assetIds(Map<String,Object> details) {
        if(details==null||!details.containsKey("assetIds"))return null;
        if(!(details.get("assetIds") instanceof List<?> raw)||raw.size()>50)throw new BadRequestException("관련 부품을 확인해주세요.");
        var ids=new LinkedHashSet<Long>();
        for(Object item:raw){if(!(item instanceof Number n)||n.longValue()<=0||n.doubleValue()!=n.longValue())throw new BadRequestException("관련 부품을 확인해주세요.");ids.add(n.longValue());}
        return new ArrayList<>(ids);
    }
    void sync(CurrentUser u,long recordId,String sid,Map<String,Object> details) {
        var ids=assetIds(details);
        // Older clients may omit links. Do not silently detach an existing history.
        if(ids==null)ids=db.queryForList("SELECT asset_id FROM workspace_asset_history WHERE record_id=?",Long.class,recordId);
        if(sid==null&&!ids.isEmpty())throw new BadRequestException("부품 정비 기록은 병원 업무로 작성해주세요.");
        var snapshots=new LinkedHashMap<Long,Map<String,Object>>();
        for(long id:ids){var rows=db.queryForList("SELECT "+COLUMNS+" FROM workspace_asset WHERE id=? AND company_id=? AND site_id=? FOR UPDATE",id,u.companyId(),sid);if(rows.isEmpty())throw new BadRequestException("선택한 병원에 속한 장비·부품을 선택해주세요.");snapshots.put(id,rows.get(0));}
        for(var row:db.queryForList("SELECT asset_id,change_kind FROM workspace_asset_history WHERE record_id=?",recordId)){
            long old=((Number)row.get("asset_id")).longValue();
            if(!ids.contains(old)){
                if(!"SERVICE".equals(row.get("change_kind")))throw new BadRequestException("장비 정보 변경 기록의 부품 연결은 유지해주세요.");
                db.update("DELETE FROM workspace_asset_history WHERE asset_id=? AND record_id=?",old,recordId);
            }
        }
        for(var entry:snapshots.entrySet())db.update("INSERT IGNORE INTO workspace_asset_history(asset_id,record_id,snapshot_json,change_kind) VALUES(?,?,?,'SERVICE')",entry.getKey(),recordId,json(Map.of("after",entry.getValue())));
    }
}
