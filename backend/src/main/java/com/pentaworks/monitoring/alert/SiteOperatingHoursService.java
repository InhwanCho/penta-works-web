package com.pentaworks.monitoring.alert;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pentaworks.monitoring.auth.CurrentUserService;
import com.pentaworks.monitoring.auth.CurrentUserService.CurrentUser;
import com.pentaworks.monitoring.admin.AuditService;
import com.pentaworks.monitoring.common.ForbiddenException;
import java.time.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SiteOperatingHoursService {
    private final JdbcTemplate jdbc; private final ObjectMapper json; private final CurrentUserService users;
    private final AuditService audit; private final KoreanPublicHolidays holidays;
    private volatile Map<String,SiteOperatingHours> cached; private volatile long expires;
    public SiteOperatingHoursService(JdbcTemplate jdbc,ObjectMapper json,CurrentUserService users,AuditService audit,KoreanPublicHolidays holidays) {
        this.jdbc=jdbc;this.json=json;this.users=users;this.audit=audit;this.holidays=holidays;
    }
    public synchronized Map<String,SiteOperatingHours> configurations() {
        if(cached!=null && System.currentTimeMillis()<expires)return cached;
        Map<String,SiteOperatingHours> result=new HashMap<>();
        jdbc.query("SELECT site_id,settings_json FROM site_operating_hours",(org.springframework.jdbc.core.RowCallbackHandler) rs->{
            try{result.put(rs.getString(1),json.readValue(rs.getString(2),SiteOperatingHours.class));}
            catch(Exception e){throw new IllegalStateException("병원 운영 시간 읽기 실패",e);}
        });cached=Map.copyOf(result);expires=System.currentTimeMillis()+15000;return cached;
    }
    public SiteOperatingHours.Status status(String siteId,ZonedDateTime now) {
        return configurations().getOrDefault(siteId,SiteOperatingHours.defaults()).status(now,holidays.dates().keySet());
    }
    public record View(SiteOperatingHours settings,SiteOperatingHours.Status status) {}
    public Map<String,View> views(CurrentUser actor) {
        Map<String,View> result=new LinkedHashMap<>();var now=ZonedDateTime.now(ZoneId.of("Asia/Seoul"));var configs=configurations();
        for(String site:users.allowedSiteIds(actor)) {var config=configs.getOrDefault(site,SiteOperatingHours.defaults());result.put(site,new View(config,config.status(now,holidays.dates().keySet())));}
        return result;
    }
    public Map<String,Object> calendar() {
        var dates=holidays.dates();
        return Map.of("source",KoreanPublicHolidays.SOURCE,"dates",dates,"throughYear",dates.keySet().stream().mapToInt(LocalDate::getYear).max().orElse(0));
    }
    @Transactional
    public View save(CurrentUser actor,String siteId,SiteOperatingHours settings) {
        if(!actor.isAdmin())throw new ForbiddenException("관리자만 병원 운영 시간을 변경할 수 있습니다.");
        users.requireSiteAccess(actor,siteId);
        try{jdbc.update("INSERT INTO site_operating_hours(site_id,settings_json,updated_by) VALUES(?,?,?) ON DUPLICATE KEY UPDATE settings_json=VALUES(settings_json),updated_by=VALUES(updated_by),updated_at=CURRENT_TIMESTAMP(6)",siteId,json.writeValueAsString(settings),actor.id());}
        catch(com.fasterxml.jackson.core.JsonProcessingException e){throw new IllegalStateException(e);}
        cached=null;expires=0;
        if(org.springframework.transaction.support.TransactionSynchronizationManager.isSynchronizationActive())
            org.springframework.transaction.support.TransactionSynchronizationManager.registerSynchronization(new org.springframework.transaction.support.TransactionSynchronization(){
                @Override public void afterCompletion(int status){cached=null;expires=0;}
            });
        audit.record(actor,"SITE_OPERATING_HOURS_UPDATED","SITE",siteId,Map.of("enabled",settings.enabled(),"appliesTo","ALL_MEMBERS","settings",settings));
        var status=settings.status(ZonedDateTime.now(ZoneId.of("Asia/Seoul")),holidays.dates().keySet());
        if(settings.enabled())resetSession(siteId,status);
        return new View(settings,status);
    }
    /** End the previous monitoring session without sending a recovery notification. */
    @Transactional
    public void resetSession(String siteId,SiteOperatingHours.Status status) {
        if(!status.enabled())return;
        if(!status.monitoring()) {
            jdbc.update("DELETE p FROM alert_pending_state p JOIN alert_rule r ON r.id=p.rule_id WHERE r.site_id=?",siteId);
            jdbc.update("UPDATE alert_event SET recovered_at=CURRENT_TIMESTAMP(6),message=CONCAT(message,' · 운영시간 외 감시 종료') WHERE site_id=? AND recovered_at IS NULL",siteId);
        } else if(status.sessionStart()!=null) {
            jdbc.update("DELETE p FROM alert_pending_state p JOIN alert_rule r ON r.id=p.rule_id WHERE r.site_id=? AND p.first_seen_at<?",siteId,java.sql.Timestamp.from(status.sessionStart()));
            jdbc.update("UPDATE alert_event SET recovered_at=CURRENT_TIMESTAMP(6),message=CONCAT(message,' · 이전 운영시간 감시 종료') WHERE site_id=? AND recovered_at IS NULL AND occurred_at<?",siteId,java.sql.Timestamp.from(status.sessionStart()));
        }
    }
}
