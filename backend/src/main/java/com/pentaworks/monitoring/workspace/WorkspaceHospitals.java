package com.pentaworks.monitoring.workspace;

import com.pentaworks.monitoring.auth.CurrentUserService;
import com.pentaworks.monitoring.auth.CurrentUserService.CurrentUser;
import com.pentaworks.monitoring.admin.AuditService;
import com.pentaworks.monitoring.common.*;
import com.pentaworks.monitoring.dashboard.DashboardService;
import com.pentaworks.monitoring.site.SiteService;
import java.util.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/workspace/hospitals")
@ConditionalOnProperty(name="app.workspace.enabled",havingValue="true")
public class WorkspaceHospitals {
    private final JdbcTemplate db;
    private final CurrentUserService users;
    private final AuditService audit;
    private final DashboardService dashboard;
    public WorkspaceHospitals(JdbcTemplate db,CurrentUserService users,AuditService audit,DashboardService dashboard) {this.db=db;this.users=users;this.audit=audit;this.dashboard=dashboard;}
    public record Input(String name,String address,String contactName,String contactPhone,String notes,String model,String serialNumber,String monitoringSiteId,List<Long> userIds,Integer revision) {}
    private String text(String value,int max,String field) {
        String s=value==null?"":value.trim();if(s.length()>max)throw new BadRequestException(field+" 입력 길이를 확인해주세요.");return s;
    }
    private String legacyName(String name) {String s=name.trim();return s.substring(0,s.offsetByCodePoints(0,Math.min(20,s.codePointCount(0,s.length()))));}
    private void admin(CurrentUser u) {if(!u.isAdmin())throw new ForbiddenException("회사 관리자만 병원을 등록·수정할 수 있습니다.");}
    public record Binding(Long hospitalId,String monitoringSiteId,String name) {}
    public String canonicalSite(long company,String sid) {
        return db.query("SELECT site_id FROM workspace_hospital WHERE company_id=? AND monitoring_site_id=?",rs->rs.next()?rs.getString(1):sid,company,sid);
    }
    public Binding binding(long company,String sid) {
        var rows=db.queryForList("SELECT id,monitoring_site_id,name FROM workspace_hospital WHERE company_id=? AND site_id=?",company,sid);
        if(rows.isEmpty())return new Binding(null,sid,null); // Existing monitoring sites provisioned by admin after V47.
        return new Binding(((Number)rows.get(0).get("id")).longValue(),(String)rows.get(0).get("monitoring_site_id"),(String)rows.get(0).get("name"));
    }
    @GetMapping("/options")
    public Map<String,Object> options(Authentication auth) {
        var u=users.require(auth);admin(u);return optionsFor(u);
    }
    private Map<String,Object> optionsFor(CurrentUser u) {
        var members=db.queryForList("SELECT id,name,email FROM app_user WHERE company_id=? AND status='ACTIVE' AND role='USER' ORDER BY name,id",u.companyId());
        // A collection site with existing service data must never be merged automatically.
        var targets=db.queryForList("""
            SELECT cs.site_id siteId,s.name FROM company_site cs JOIN site s ON s.site=cs.site_id
            WHERE cs.company_id=? AND NOT EXISTS(SELECT 1 FROM workspace_hospital h WHERE h.company_id=cs.company_id AND (h.site_id=cs.site_id OR h.monitoring_site_id=cs.site_id))
              AND NOT EXISTS(SELECT 1 FROM workspace_record r WHERE r.company_id=cs.company_id AND r.site_id=cs.site_id)
              AND NOT EXISTS(SELECT 1 FROM workspace_asset a WHERE a.company_id=cs.company_id AND a.site_id=cs.site_id)
              AND NOT EXISTS(SELECT 1 FROM workspace_schedule w WHERE w.company_id=cs.company_id AND w.site_id=cs.site_id)
              AND NOT EXISTS(SELECT 1 FROM workspace_preparation p WHERE p.company_id=cs.company_id AND p.site_id=cs.site_id)
              AND NOT EXISTS(SELECT 1 FROM workspace_hospital_plan p WHERE p.company_id=cs.company_id AND p.site_id=cs.site_id)
              AND NOT EXISTS(SELECT 1 FROM workspace_office_snapshot o WHERE o.company_id=cs.company_id AND o.site_id=cs.site_id)
            ORDER BY s.name,cs.site_id
            """,u.companyId());
        return Map.of("members",members,"monitoringSites",targets);
    }
    @GetMapping("/{siteId}")
    public Map<String,Object> get(@PathVariable String siteId,Authentication auth) {
        var u=users.require(auth);String sid=SiteService.normalizeSiteId(siteId);users.requireSiteAccess(u,sid);
        var rows=db.queryForList("""
            SELECT s.site siteId,COALESCE(h.name,s.name) name,COALESCE(NULLIF(p.address,''),NULLIF(JSON_UNQUOTE(JSON_EXTRACT(o.response_json,'$.site.address')),'null'),'') address,
              COALESCE(p.contact_name,'') contactName,COALESCE(p.contact_phone,'') contactPhone,
              h.id hospitalId,h.monitoring_site_id monitoringSiteId,COALESCE(h.notes,'') notes,COALESCE(h.revision,0) revision,
              cs.is_dashboard_visible dashboardVisible
            FROM company_site cs JOIN site s ON s.site=cs.site_id LEFT JOIN site_profile p ON p.site_id=cs.site_id
              LEFT JOIN workspace_hospital h ON h.company_id=cs.company_id AND h.site_id=cs.site_id
              LEFT JOIN workspace_office_snapshot o ON o.company_id=cs.company_id AND o.site_id=cs.site_id
            WHERE cs.company_id=? AND cs.site_id=?
            """,u.companyId(),sid);
        if(rows.isEmpty())throw new NotFoundException("병원을 찾을 수 없습니다.");
        var result=new LinkedHashMap<>(rows.get(0));var b=binding(u.companyId(),sid);
        result.put("monitoringSiteId",b.monitoringSiteId());result.put("monitoringConnected",b.monitoringSiteId()!=null);
        if(u.isAdmin())result.put("userIds",db.queryForList("SELECT us.user_id FROM user_site us JOIN app_user u ON u.id=us.user_id WHERE (us.site_id=? OR us.site_id=?) AND u.company_id=? AND u.role='USER' AND u.status='ACTIVE'",Long.class,sid,b.monitoringSiteId(),u.companyId()).stream().distinct().toList());
        return result;
    }
    @PostMapping @Transactional
    public Map<String,Object> create(@RequestBody Input i,Authentication auth) {
        var u=users.require(auth);admin(u);
        String sid="h-"+UUID.randomUUID().toString().replace("-","").substring(0,24);
        validate(i);
        db.update("INSERT INTO site(site,name) VALUES(?,?)",sid,legacyName(i.name()));
        db.update("INSERT INTO company_site(company_id,site_id,is_dashboard_visible) VALUES(?,?,FALSE)",u.companyId(),sid);
        db.update("INSERT INTO workspace_hospital(company_id,site_id,name,notes) VALUES(?,?,?,?)",u.companyId(),sid,i.name().trim(),"");
        save(u,sid,i,true);
        String model=text(i.model(),200,"MRI 모델");
        if(model.isBlank()&&!text(i.serialNumber(),200,"시리얼 번호").isBlank())throw new BadRequestException("시리얼 번호와 함께 MRI 모델을 입력해주세요.");
        if(!model.isBlank())db.update("INSERT INTO workspace_asset(company_id,site_id,asset_type,name,model,serial_number,notes) VALUES(?,?,'MRI',?,?,?,'')",u.companyId(),sid,model,model,text(i.serialNumber(),200,"시리얼 번호"));
        audit.record(u,"HOSPITAL_CREATED","SITE",sid,Map.of("name",i.name().trim()));
        return get(sid,auth);
    }
    private void validate(Input i) {
        if(i==null||text(i.name(),120,"병원명").isBlank())throw new BadRequestException("병원명을 입력해주세요.");
        text(i.address(),255,"주소");text(i.contactName(),80,"연락 담당자");text(i.contactPhone(),30,"연락처");text(i.notes(),10000,"메모");
    }
    @PutMapping("/{siteId}") @Transactional
    public Map<String,Object> update(@PathVariable String siteId,@RequestBody Input i,Authentication auth) {
        var u=users.require(auth);admin(u);String sid=SiteService.normalizeSiteId(siteId);users.requireSiteAccess(u,sid);validate(i);
        save(u,sid,i,false);audit.record(u,"HOSPITAL_UPDATED","SITE",sid,Map.of("name",i.name().trim()));return get(sid,auth);
    }
    private void save(CurrentUser u,String sid,Input i,boolean creating) {
        var managed=db.queryForList("SELECT site_id FROM company_site WHERE company_id=? AND site_id=? FOR UPDATE",u.companyId(),sid);
        if(managed.isEmpty())throw new ForbiddenException("회사에 등록된 병원만 수정할 수 있습니다.");
        var rows=db.queryForList("SELECT id,revision,monitoring_site_id FROM workspace_hospital WHERE company_id=? AND site_id=? FOR UPDATE",u.companyId(),sid);
        boolean firstRegistry=rows.isEmpty();
        if(rows.isEmpty()) {db.update("INSERT INTO workspace_hospital(company_id,site_id,name,monitoring_site_id,notes) VALUES(?,?,?,?,'')",u.companyId(),sid,i.name().trim(),sid);rows=db.queryForList("SELECT id,revision,monitoring_site_id FROM workspace_hospital WHERE company_id=? AND site_id=? FOR UPDATE",u.companyId(),sid);}
        var before=rows.get(0);
        if(!creating&&(i.revision()==null||i.revision()!=(firstRegistry?0:((Number)before.get("revision")).intValue())))throw new BadRequestException("다른 담당자가 수정했습니다. 새로 열어주세요.");
        String previous=(String)before.get("monitoring_site_id");String monitoring=i.monitoringSiteId()==null||i.monitoringSiteId().isBlank()?null:SiteService.normalizeSiteId(i.monitoringSiteId().trim());
        if(previous!=null&&!Objects.equals(previous,monitoring))throw new BadRequestException("기존 모니터링 연결의 변경은 관리자에게 문의해주세요.");
        if(monitoring!=null&&!Objects.equals(previous,monitoring)) {
            var target=db.queryForList("SELECT site_id FROM company_site WHERE company_id=? AND site_id=? FOR UPDATE",u.companyId(),monitoring);
            if(target.isEmpty())throw new BadRequestException("회사에 등록된 수집 사이트를 선택해주세요.");
            // Recheck availability under the company-site lock (including legacy service records).
            var available=(List<?>)optionsFor(u).get("monitoringSites");
            boolean found=available.stream().anyMatch(o->monitoring.equals(((Map<?,?>)o).get("siteId")));
            if(!found)throw new BadRequestException("이미 병원에 연결됐거나 업무 데이터가 있는 수집 사이트입니다.");
        }
        if(i.userIds()==null||new HashSet<>(i.userIds()).size()!=i.userIds().size()||i.userIds().size()>500)throw new BadRequestException("접근할 직원을 확인해주세요.");
        for(Long id:i.userIds())if(id==null||!Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM app_user WHERE id=? AND company_id=? AND role='USER' AND status='ACTIVE')",Boolean.class,id,u.companyId())))throw new BadRequestException("회사 내 사용 가능한 직원을 선택해주세요.");
        db.update("UPDATE site SET name=? WHERE site=?",legacyName(i.name()),sid);
        db.update("INSERT INTO site_profile(site_id,display_name,address,contact_name,contact_phone) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE display_name=VALUES(display_name),address=VALUES(address),contact_name=VALUES(contact_name),contact_phone=VALUES(contact_phone)",sid,i.name().trim(),text(i.address(),255,"주소"),text(i.contactName(),80,"연락 담당자"),text(i.contactPhone(),30,"연락처"));
        try {
            db.update("UPDATE workspace_hospital SET name=?,notes=?,monitoring_site_id=?,revision=revision+1 WHERE company_id=? AND site_id=?",i.name().trim(),text(i.notes(),10000,"메모"),monitoring,u.companyId(),sid);
        } catch(org.springframework.dao.DuplicateKeyException e) {throw new ConflictException("다른 병원이 먼저 연결한 수집 사이트입니다. 다시 선택해주세요.");}
        db.update("DELETE us FROM user_site us JOIN app_user u ON u.id=us.user_id WHERE us.site_id=? AND u.company_id=? AND u.role='USER' AND u.status='ACTIVE'",sid,u.companyId());
        if(monitoring!=null&&!monitoring.equals(sid)) {
            db.update("UPDATE site SET name=? WHERE site=?",legacyName(i.name()),monitoring);
            db.update("DELETE us FROM user_site us JOIN app_user u ON u.id=us.user_id WHERE us.site_id=? AND u.company_id=? AND u.role='USER' AND u.status='ACTIVE'",monitoring,u.companyId());
        }
        for(long id:i.userIds()) {db.update("INSERT IGNORE INTO user_site(user_id,site_id) VALUES(?,?)",id,sid);if(monitoring!=null&&!monitoring.equals(sid))db.update("INSERT IGNORE INTO user_site(user_id,site_id) VALUES(?,?)",id,monitoring);}
        dashboard.invalidateCache();
    }
}
