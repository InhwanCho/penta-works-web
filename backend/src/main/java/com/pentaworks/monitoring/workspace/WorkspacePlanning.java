package com.pentaworks.monitoring.workspace;
import com.pentaworks.monitoring.auth.CurrentUserService;
import com.pentaworks.monitoring.common.*;
import com.pentaworks.monitoring.site.SiteService;
import java.time.LocalDate;
import java.util.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping("/api/v1/workspace")
@ConditionalOnProperty(name="app.workspace.enabled",havingValue="true")
public class WorkspacePlanning {
 private final JdbcTemplate db;private final CurrentUserService users;
 public WorkspacePlanning(JdbcTemplate db,CurrentUserService users){this.db=db;this.users=users;}
 @GetMapping("/planning")
 public Map<String,Object> planning(Authentication auth){var u=users.require(auth);var sites=users.allowedSiteIds(u);var plans=db.queryForList("SELECT site_id siteId,pm_interval_months pmIntervalMonths,DATE_FORMAT(pm_override,'%Y-%m-%d') pmOverride,DATE_FORMAT(acr_full_override,'%Y-%m-%d') acrFullOverride,DATE_FORMAT(acr_doc_override,'%Y-%m-%d') acrDocOverride,DATE_FORMAT(last_pm_date,'%Y-%m-%d') lastPmDate,DATE_FORMAT(last_acr_full_date,'%Y-%m-%d') lastAcrFullDate,DATE_FORMAT(last_acr_doc_date,'%Y-%m-%d') lastAcrDocDate FROM workspace_hospital_plan WHERE company_id=?",u.companyId()).stream().filter(p->sites.contains(p.get("siteId"))).toList();var prep=db.queryForList("SELECT p.id,p.author_id authorId,p.site_id siteId,s.name siteName,p.content,p.done FROM workspace_preparation p LEFT JOIN site s ON s.site=p.site_id WHERE p.company_id=? ORDER BY p.created_at,p.id",u.companyId()).stream().filter(p->p.get("siteId")==null||sites.contains(p.get("siteId"))).toList();return Map.of("plans",plans,"preparations",prep);}
 public record PlanInput(int pmIntervalMonths,LocalDate pmOverride,LocalDate acrFullOverride,LocalDate acrDocOverride){}
 @PutMapping("/planning/{siteId}")
 public Map<String,Boolean> plan(@PathVariable String siteId,@RequestBody PlanInput input,Authentication auth){var u=users.require(auth);String sid=SiteService.normalizeSiteId(siteId);users.requireSiteAccess(u,sid);if(!u.isAdmin())throw new ForbiddenException("관리자만 점검 주기를 변경할 수 있습니다.");if(input.pmIntervalMonths()<1||input.pmIntervalMonths()>120)throw new BadRequestException("PM 주기는 1~120개월로 입력해주세요.");db.update("INSERT INTO workspace_hospital_plan(company_id,site_id,pm_interval_months,pm_override,acr_full_override,acr_doc_override) VALUES(?,?,?,?,?,?) ON DUPLICATE KEY UPDATE pm_interval_months=VALUES(pm_interval_months),pm_override=VALUES(pm_override),acr_full_override=VALUES(acr_full_override),acr_doc_override=VALUES(acr_doc_override)",u.companyId(),sid,input.pmIntervalMonths(),input.pmOverride(),input.acrFullOverride(),input.acrDocOverride());return Map.of("saved",true);}
 public record Checked(boolean done){}
 @PatchMapping("/preparations/{id}")
 public Map<String,Boolean> checked(@PathVariable long id,@RequestBody Checked input,Authentication auth){var u=users.require(auth);var rows=db.queryForList("SELECT site_id FROM workspace_preparation WHERE id=? AND company_id=?",id,u.companyId());if(rows.isEmpty())throw new NotFoundException("준비물을 찾을 수 없습니다.");Object sid=rows.get(0).get("site_id");if(sid!=null)users.requireSiteAccess(u,sid.toString());db.update("UPDATE workspace_preparation SET done=? WHERE id=? AND company_id=?",input.done(),id,u.companyId());return Map.of("saved",true);}
}
