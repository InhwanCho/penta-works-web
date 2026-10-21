package com.pentaworks.monitoring.workspace;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pentaworks.monitoring.auth.CurrentUserService;
import com.pentaworks.monitoring.common.BadRequestException;
import com.pentaworks.monitoring.office.OfficeAssetsResponse;
import com.pentaworks.monitoring.office.OfficeAssetsService;
import com.pentaworks.monitoring.office.OfficeIntegrationException;
import com.pentaworks.monitoring.site.SiteService;
import java.time.LocalDate;
import java.util.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/workspace")
@ConditionalOnProperty(name="app.workspace.enabled",havingValue="true")
public class WorkspaceHistoryController {
    private final JdbcTemplate db;
    private final CurrentUserService users;
    private final OfficeAssetsService office;
    private final ObjectMapper mapper;
    public WorkspaceHistoryController(JdbcTemplate db,CurrentUserService users,OfficeAssetsService office,ObjectMapper mapper) {
        this.db=db;this.users=users;this.office=office;this.mapper=mapper;
    }
    // One company-scoped snapshot read plus one source-ID read, rather than a request per hospital.
    List<Map<String,Object>> legacy(long company,Set<String> allowed,LocalDate from,LocalDate to,List<String> failures) {
        Set<String> imported=new HashSet<>(db.queryForList("SELECT source_id FROM workspace_record WHERE company_id=? AND source_id LIKE 'office:%:maintenance:%'",String.class,company));
        Set<String> found=new HashSet<>();
        List<Map<String,Object>> result=new ArrayList<>();
        for(var row:db.queryForList("SELECT site_id,response_json FROM workspace_office_snapshot WHERE company_id=?",company)) {
            String site=row.get("site_id").toString();if(!allowed.contains(site))continue;found.add(site);
            try {append(result,site,mapper.readValue(row.get("response_json").toString(),OfficeAssetsResponse.class),imported,from,to);}
            catch(Exception ex){failures.add(site);}
        }
        for(String site:allowed) if(!found.contains(site)) {
            try {append(result,site,office.bySite(site,company),imported,from,to);}
            catch(com.pentaworks.monitoring.common.NotFoundException ex){ /* No legacy history for this hospital. */ }
            catch(OfficeIntegrationException ex){if(ex.status().value()!=404)failures.add(site);}
            catch(Exception ex){failures.add(site);}
        }
        return result;
    }
    private void append(List<Map<String,Object>> result,String site,OfficeAssetsResponse data,Set<String> imported,LocalDate from,LocalDate to) {
        for(var r:data.maintenanceHistory()) {
            if(imported.contains("office:"+site+":maintenance:"+r.id()))continue;
            String date=Objects.toString(r.workDate(),"");
            if(from!=null&&(date.isEmpty()||date.compareTo(from.toString())<0))continue;
            if(to!=null&&date.compareTo(to.toString())>0)continue;
            var item=new LinkedHashMap<String,Object>();item.put("key","old-"+site+"-"+r.id());item.put("siteId",site);item.put("siteName",data.site().name());item.put("date",date);item.put("maintenance",r);result.add(item);
        }
    }
    @GetMapping("/legacy-history")
    public Map<String,Object> calendar(@RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate from,@RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate to,Authentication auth) {
        if(from.isAfter(to))throw new BadRequestException("조회 기간을 확인해주세요.");
        var u=users.require(auth);var failures=new ArrayList<String>();
        return Map.of("items",legacy(u.companyId(),users.allowedSiteIds(u),from,to,failures),"failedSites",failures);
    }
    @GetMapping("/hospital-history/{siteId}")
    public Map<String,Object> hospital(@PathVariable String siteId,@RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="10") int size,Authentication auth) {
        var u=users.require(auth);String site=SiteService.normalizeSiteId(siteId);users.requireSiteAccess(u,site);
        page=Math.max(1,page);size=Math.max(1,Math.min(50,size));long offset=(long)(page-1)*size;
        var failures=new ArrayList<String>();var items=legacy(u.companyId(),Set.of(site),null,null,failures);
        Long count=db.queryForObject("SELECT COUNT(*) FROM workspace_record WHERE company_id=? AND site_id=? AND deleted_at IS NULL",Long.class,u.companyId(),site);
        long total=(count==null?0:count)+items.size();
        // Fetch only the prefix needed for this combined page; individual records retain normal authorization.
        String sql=WorkspaceController.RECORDS.replace("WHERE w.company_id=?", "WHERE w.site_id=? AND w.company_id=?")+" LIMIT ?";
        for(var record:db.queryForList(sql,site,u.companyId(),Math.min(total,offset+size))){var item=new LinkedHashMap<String,Object>();item.put("key","new-"+record.get("id"));item.put("date",record.get("workDate"));item.put("record",record);items.add(item);}
        items.sort(Comparator.<Map<String,Object>,String>comparing(r->Objects.toString(r.get("date"),"")).reversed().thenComparing(r->r.containsKey("record")?0:1).thenComparing(Comparator.<Map<String,Object>,Long>comparing(r->r.containsKey("record")?((Number)((Map<?,?>)r.get("record")).get("id")).longValue():0L).reversed()).thenComparing(r->r.get("key").toString()));
        int start=(int)Math.min(offset,items.size()),end=(int)Math.min(offset+size,items.size());
        return Map.of("items",items.subList(start,end),"total",total,"failedSites",failures);
    }
}
