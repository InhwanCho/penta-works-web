package com.pentaworks.monitoring.alert;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pentaworks.monitoring.auth.CurrentUserService;
import com.pentaworks.monitoring.auth.CurrentUserService.CurrentUser;
import com.pentaworks.monitoring.admin.AuditService;
import com.pentaworks.monitoring.common.BadRequestException;
import com.pentaworks.monitoring.common.NotFoundException;
import java.time.LocalTime;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Personal patterns are snapshots: another engineer's edits never change this user's rules. */
@Service
public class PersonalAlertService {
    private final JdbcTemplate jdbc;
    private final CurrentUserService users;
    private final AlertService defaults;
    private final RollingAverageService averages;
    private final ObjectMapper json;
    private final AuditService audit;
    public PersonalAlertService(JdbcTemplate jdbc, CurrentUserService users, AlertService defaults,
                                RollingAverageService averages, ObjectMapper json, AuditService audit) {
        this.jdbc=jdbc; this.users=users; this.defaults=defaults; this.averages=averages; this.json=json; this.audit=audit;
    }

    public List<CurrentUser> activeUsers() {
        return jdbc.query("""
            SELECT u.id,u.company_id,u.email,u.name,u.role,u.status FROM app_user u
            JOIN company c ON c.id=u.company_id AND c.status='ACTIVE' WHERE u.status='ACTIVE'
            """, (rs,n)->new CurrentUser(rs.getLong(1),rs.getLong(2),rs.getString(3),rs.getString(4),rs.getString(5),rs.getString(6)));
    }
    public List<SiteAlertSettings> settings(CurrentUser actor) {
        return settings(actor, defaults.alertSettings(), averages.states());
    }
    public List<SiteAlertSettings> settings(CurrentUser actor, List<SiteAlertSettings> base,
                Map<String,Map<String,RollingAverageService.AverageState>> states) {
        Set<String> allowed=users.allowedSiteIds(actor);
        Map<String,SiteAlertSettings> saved=stored(actor.id());
        Map<String,LocalTime[]> oldWindows=new HashMap<>();
        Set<String> contactSites=new HashSet<>(),enabledContactSites=new HashSet<>();
        boolean missingSnapshot=false;
        for(var site:base)if(allowed.contains(site.siteid())&&!saved.containsKey(site.siteid()))missingSnapshot=true;
        if(missingSnapshot) {
            jdbc.query("SELECT site_id,quiet_start,quiet_end,is_enabled FROM site_alert_recipient WHERE user_id=? ORDER BY priority,id",
                (org.springframework.jdbc.core.RowCallbackHandler) rs->{
                    String id=rs.getString(1);contactSites.add(id);if(rs.getBoolean(4))enabledContactSites.add(id);
                    if(rs.getBoolean(4)&&rs.getTime(2)!=null&&rs.getTime(3)!=null)oldWindows.merge(id,new LocalTime[]{rs.getTime(2).toLocalTime(),rs.getTime(3).toLocalTime()},(a,b)->mergeQuietWindows(a[0],a[1],b));
                },actor.id());
            List<Object[]> snapshots=new ArrayList<>();
            for(var site:base) {
                if(!allowed.contains(site.siteid())||saved.containsKey(site.siteid()))continue;
                var window=mergeQuietWindows(site.quietStart(),site.quietEnd(),oldWindows.get(site.siteid()));
                boolean fullDay=window[0]!=null&&window[0].equals(window[1]);
                var initial=copy(site,site.thresholds(),site.alertsEnabled()&&!fullDay&&(!contactSites.contains(site.siteid())||enabledContactSites.contains(site.siteid())),fullDay?null:window[0],fullDay?null:window[1]);
                snapshots.add(new Object[]{actor.id(),site.siteid(),encode(initial)});
            }
            jdbc.batchUpdate("INSERT IGNORE INTO user_site_alert_settings(user_id,site_id,settings_json) VALUES(?,?,?)",snapshots);
            saved=stored(actor.id());
            // Recipient switches move into personal policy; preserve old all-disabled state above first.
            jdbc.update("UPDATE site_alert_recipient r JOIN user_site_alert_settings p ON p.user_id=r.user_id AND p.site_id=r.site_id SET r.is_enabled=TRUE WHERE r.user_id=? AND r.is_enabled=FALSE",actor.id());
        }
        List<SiteAlertSettings> result=new ArrayList<>();
        for(var site:base) {
            if(!allowed.contains(site.siteid()))continue;
            var config=saved.get(site.siteid());
            if(config==null)throw new IllegalStateException("개인 알림 패턴을 초기화하지 못했습니다.");
            result.add(enrich(config,site,states.getOrDefault(site.siteid(),Map.of())));
        }
        return result;
    }
    private Map<String,SiteAlertSettings> stored(long userId) {
        Map<String,SiteAlertSettings> result=new HashMap<>();
        jdbc.query("SELECT site_id,settings_json FROM user_site_alert_settings WHERE user_id=?",
            (org.springframework.jdbc.core.RowCallbackHandler) rs->result.put(rs.getString(1),decode(rs.getString(2))),userId);
        return result;
    }
    // Preserve both legacy windows. If they are disjoint, cover the smaller gap conservatively.
    static LocalTime[] mergeQuietWindows(LocalTime start,LocalTime end,LocalTime[] recipient) {
        if(recipient==null)return new LocalTime[]{start,end};
        if(start==null||end==null)return recipient;
        if(start.equals(end)||recipient[0].equals(recipient[1]))return new LocalTime[]{LocalTime.MIDNIGHT,LocalTime.MIDNIGHT};
        boolean[] quiet=new boolean[1440];
        for(int minute=0;minute<1440;minute++) {
            LocalTime time=LocalTime.of(minute/60,minute%60);
            quiet[minute]=inWindow(time,start,end)||inWindow(time,recipient[0],recipient[1]);
        }
        int bestStart=-1,bestLength=0;
        for(int minute=0;minute<1440;minute++) {
            if(quiet[minute]||!quiet[(minute+1439)%1440])continue;
            int length=0;while(length<1440&&!quiet[(minute+length)%1440])length++;
            if(length>bestLength){bestStart=minute;bestLength=length;}
        }
        if(bestStart<0)return new LocalTime[]{LocalTime.MIDNIGHT,LocalTime.MIDNIGHT};
        int begin=(bestStart+bestLength)%1440;
        return new LocalTime[]{LocalTime.of(begin/60,begin%60),LocalTime.of(bestStart/60,bestStart%60)};
    }
    private static boolean inWindow(LocalTime time,LocalTime start,LocalTime end) {
        if(start==null||end==null||start.equals(end))return false;
        return start.isBefore(end)?!time.isBefore(start)&&time.isBefore(end):!time.isBefore(start)||time.isBefore(end);
    }

    public SiteAlertSettings settings(CurrentUser actor,String siteId) {
        users.requireSiteAccess(actor,siteId);
        return settings(actor).stream().filter(s->s.siteid().equals(siteId)).findFirst().orElseThrow(()->new NotFoundException("병원을 찾을 수 없습니다."));
    }

    SiteAlertSettings currentForUpdate(CurrentUser actor,String siteId) {
        SiteAlertSettings meta=settings(actor,siteId);
        SiteAlertSettings locked=jdbc.queryForObject("SELECT settings_json FROM user_site_alert_settings WHERE user_id=? AND site_id=? FOR UPDATE",(rs,n)->decode(rs.getString(1)),actor.id(),siteId);
        return enrich(locked,meta,averages.states().getOrDefault(siteId,Map.of()));
    }

    @Transactional
    public SiteAlertSettings save(CurrentUser actor,String siteId,AlertController.UpdateAlertThresholdsRequest request) {
        SiteAlertSettings current=currentForUpdate(actor,siteId);
        Map<String,AlertController.ThresholdUpdateRequest> updates=new HashMap<>();
        for(var item:request.thresholds()) {
            if(updates.put(item.key(),item)!=null || current.thresholds().stream().noneMatch(t->t.key().equals(item.key()))) throw new BadRequestException("지원하지 않거나 중복된 측정항목입니다.");
            validateMetric(item.min(),item.max(),item.useAverage(),item.tolerancePercent());
            if(item.missingThreshold()!=null && (item.missingThreshold()<3 || item.missingThreshold()>288))throw new BadRequestException("항목 누락 횟수는 3회에서 288회 사이여야 합니다.");
        }
        List<AlertThreshold> thresholds=current.thresholds().stream().map(t->{
            var u=updates.get(t.key());
            if(u==null)return t;
            return new AlertThreshold(t.key(),t.label(),t.unit(),u.min(),u.max(),u.active(),u.min(),u.max(),u.useAverage()==null?t.useAverage():u.useAverage(),u.tolerancePercent()==null?t.tolerancePercent():u.tolerancePercent(),null,0,0,null,false,"NO_AVERAGE",false,u.missingActive()==null?t.missingActive():u.missingActive(),u.missingThreshold()==null?t.missingThreshold():u.missingThreshold());
        }).toList();
        int interval=request.collectionIntervalMinutes()==null?current.collectionIntervalMinutes():request.collectionIntervalMinutes();
        int missing=request.missingCollectionThreshold()==null?current.missingCollectionThreshold():request.missingCollectionThreshold();
        validatePolicy(request,interval,missing);
        if(request.alertsEnabled()&&!current.dashboardVisible())throw new BadRequestException("대시보드에서 숨긴 병원은 알림을 켤 수 없습니다.");
        SiteAlertSettings value=new SiteAlertSettings(siteId,current.name(),true,thresholds,interval*missing,request.noDataActive(),request.alertsEnabled(),request.triggerAfterMinutes(),request.repeatMinutes(),request.quietStart(),request.quietEnd(),request.suppressWeekends(),request.holidayDates().stream().distinct().sorted().toList(),current.dashboardVisible(),request.coldChillerActive()==null?current.coldChillerActive():request.coldChillerActive(),interval,missing);
        persist(actor,value);
        return settings(actor,siteId);
    }
    @Transactional
    public SiteAlertSettings metric(CurrentUser actor,String siteId,String key,AlertController.ThresholdRequest r) {
        SiteAlertSettings s=currentForUpdate(actor,siteId);
        return save(actor,siteId,new AlertController.UpdateAlertThresholdsRequest(List.of(new AlertController.ThresholdUpdateRequest(key,r.min(),r.max(),r.active(),r.useAverage(),r.tolerancePercent(),r.missingActive(),r.missingThreshold())),s.noDataMinutes(),s.noDataActive(),s.alertsEnabled(),s.triggerAfterMinutes(),s.repeatMinutes(),s.quietStart(),s.quietEnd(),s.suppressWeekends(),s.holidayDates(),s.coldChillerActive(),s.collectionIntervalMinutes(),s.missingCollectionThreshold()));
    }
    @Transactional
    public SiteAlertSettings enabled(CurrentUser actor,String siteId,boolean enabled) {
        SiteAlertSettings s=currentForUpdate(actor,siteId);
        if(enabled&&!s.dashboardVisible())throw new BadRequestException("대시보드에서 숨긴 병원은 알림을 켤 수 없습니다.");
        persist(actor,copy(s,s.thresholds(),enabled,s.quietStart(),s.quietEnd()));
        return settings(actor,siteId);
    }
    @Transactional
    public SiteAlertSettings reset(CurrentUser actor,String siteId) {
        users.requireSiteAccess(actor,siteId);
        SiteAlertSettings base=defaults.alertSettings().stream().filter(s->s.siteid().equals(siteId)).findFirst().orElseThrow(()->new NotFoundException("병원을 찾을 수 없습니다."));
        persist(actor,base);
        return settings(actor,siteId);
    }
    private void persist(CurrentUser actor,SiteAlertSettings value) {
        users.requireSiteAccess(actor,value.siteid());
        jdbc.update("INSERT INTO user_site_alert_settings(user_id,site_id,settings_json) VALUES(?,?,?) ON DUPLICATE KEY UPDATE settings_json=VALUES(settings_json)",actor.id(),value.siteid(),encode(value));
        // Only this user's incidents and pending duration change; acknowledgement is never automatic.
        jdbc.update("DELETE p FROM alert_pending_state p JOIN alert_rule r ON r.id=p.rule_id WHERE r.user_id=? AND r.site_id=?",actor.id(),value.siteid());
        List<String> disabled=new ArrayList<>(value.thresholds().stream().filter(t->!t.active()).map(AlertThreshold::key).toList());
        if(!value.noDataActive())disabled.add("__data__");
        if(!value.coldChillerActive())disabled.add("__cold_chiller__");
        List<Object> args=new ArrayList<>(List.of(actor.id(),value.siteid(),value.alertsEnabled()));
        args.addAll(disabled);
        String clause=disabled.isEmpty()?"":" OR (r.rule_type<>'METRIC_MISSING' AND r.metric_key IN ("+String.join(",",Collections.nCopies(disabled.size(),"?"))+"))";
        jdbc.update("UPDATE alert_event e JOIN alert_rule r ON r.id=e.rule_id SET e.recovered_at=CURRENT_TIMESTAMP(6) WHERE r.user_id=? AND r.site_id=? AND e.recovered_at IS NULL AND (?=FALSE"+clause+")",args.toArray());
        for(var t:value.thresholds()) if(!t.missingActive()) jdbc.update("UPDATE alert_event e JOIN alert_rule r ON r.id=e.rule_id SET e.recovered_at=CURRENT_TIMESTAMP(6) WHERE r.user_id=? AND r.site_id=? AND r.metric_key=? AND r.rule_type='METRIC_MISSING' AND e.recovered_at IS NULL",actor.id(),value.siteid(),t.key());
        audit.record(actor,"PERSONAL_ALERT_PATTERN_UPDATED","SITE",value.siteid(),Map.of("ownerId",actor.id()));
    }
    static void validateMetric(Double min,Double max,Boolean average,Double tolerance) {
        AlertService.validateThreshold(min,max);
        if((average==null)!=(tolerance==null)||tolerance!=null&&(!Double.isFinite(tolerance)||tolerance<0.1||tolerance>100))throw new BadRequestException("허용편차는 0.1%에서 100% 사이여야 합니다.");
    }
    static void validatePolicy(AlertController.UpdateAlertThresholdsRequest r,int interval,int missing) {
        if(interval<5||interval>1440||missing<1||missing>288||interval*missing>1440)throw new BadRequestException("수집 누락 기준은 5분에서 1440분 사이여야 합니다.");
        if(r.triggerAfterMinutes()<0||r.triggerAfterMinutes()>1440||r.repeatMinutes()<0||r.repeatMinutes()>10080||r.repeatMinutes()>0&&r.repeatMinutes()<5)throw new BadRequestException("이상 지속 시간 또는 반복 주기를 확인해주세요.");
        if((r.quietStart()==null)!=(r.quietEnd()==null)||r.quietStart()!=null&&r.quietStart().equals(r.quietEnd()))throw new BadRequestException("조용한 시간의 시작과 종료를 서로 다르게 입력해주세요.");
        if(r.holidayDates().size()>100||r.holidayDates().stream().anyMatch(Objects::isNull))throw new BadRequestException("지정 휴일은 최대 100일입니다.");
    }
    static SiteAlertSettings copy(SiteAlertSettings s,List<AlertThreshold> thresholds,boolean enabled,LocalTime start,LocalTime end) {
        return new SiteAlertSettings(s.siteid(),s.name(),true,thresholds,s.noDataMinutes(),s.noDataActive(),enabled,s.triggerAfterMinutes(),s.repeatMinutes(),start,end,s.suppressWeekends(),s.holidayDates(),s.dashboardVisible(),s.coldChillerActive(),s.collectionIntervalMinutes(),s.missingCollectionThreshold());
    }
    static SiteAlertSettings enrich(SiteAlertSettings config,SiteAlertSettings base,Map<String,RollingAverageService.AverageState> states) {
        Map<String,AlertThreshold> stored=new HashMap<>();config.thresholds().forEach(t->stored.put(t.key(),t));
        List<AlertThreshold> thresholds=base.thresholds().stream().map(meta->{
            AlertThreshold t=stored.getOrDefault(meta.key(),meta);
            var a=states.getOrDefault(t.key(),RollingAverageService.AverageState.DEFAULT);
            var state=new RollingAverageService.AverageState(t.useAverage(),t.tolerancePercent(),a.averageValue(),a.sampleCount(),a.zeroCount(),a.capturedAt(),a.lastSampleAt(),a.historical());
            var range=RollingAverageService.effectiveRange(state,RollingAverageService.now());
            return new AlertThreshold(t.key(),meta.label(),meta.unit(),t.min(),t.max(),t.active(),range==null?t.min():range.min(),range==null?t.max():range.max(),t.useAverage(),t.tolerancePercent(),a.averageValue(),a.sampleCount(),a.zeroCount(),a.capturedAt(),range!=null,RollingAverageService.unavailableReason(state,RollingAverageService.now()),a.historical(),t.missingActive(),t.missingThreshold());
        }).toList();
        return new SiteAlertSettings(base.siteid(),base.name(),true,thresholds,config.noDataMinutes(),config.noDataActive(),config.alertsEnabled(),config.triggerAfterMinutes(),config.repeatMinutes(),config.quietStart(),config.quietEnd(),config.suppressWeekends(),config.holidayDates(),base.dashboardVisible(),config.coldChillerActive(),config.collectionIntervalMinutes(),config.missingCollectionThreshold());
    }
    private String encode(SiteAlertSettings value) {try{return json.writeValueAsString(value);}catch(JsonProcessingException e){throw new IllegalStateException("알림 패턴 저장 실패",e);}}
    private SiteAlertSettings decode(String value) {try{return json.readValue(value,SiteAlertSettings.class);}catch(JsonProcessingException e){throw new IllegalStateException("알림 패턴 읽기 실패",e);}}

    public com.pentaworks.monitoring.dashboard.DashboardResponse dashboard(CurrentUser actor, com.pentaworks.monitoring.dashboard.DashboardResponse data) {
        Map<String,SiteAlertSettings> configs=new HashMap<>();settings(actor).forEach(s->configs.put(s.siteid(),s));
        Map<String,List<com.pentaworks.monitoring.dashboard.DashboardResponse.AlertIssue>> bySite=new HashMap<>();
        jdbc.query("""
            SELECT e.id,e.site_id,r.metric_key,e.event_type,e.message,e.occurred_at,a.acknowledged_at
            FROM alert_event e JOIN alert_rule r ON r.id=e.rule_id
            LEFT JOIN alert_event_acknowledgement a ON a.event_id=e.id AND a.user_id=?
            WHERE r.user_id=? AND e.recovered_at IS NULL AND e.event_type IN ('LOW','HIGH','NO_DATA','METRIC_MISSING')
              AND EXISTS (SELECT 1 FROM site_alert_recipient recipient
                           WHERE recipient.site_id=e.site_id AND recipient.user_id=r.user_id
                             AND recipient.is_enabled=TRUE)
            ORDER BY e.occurred_at DESC,e.id DESC
            """,(org.springframework.jdbc.core.RowCallbackHandler) rs->bySite.computeIfAbsent(rs.getString(2),ignored->new ArrayList<>()).add(new com.pentaworks.monitoring.dashboard.DashboardResponse.AlertIssue(rs.getLong(1),rs.getString(3),rs.getString(4),rs.getString(5),rs.getTimestamp(6).toInstant().toString(),rs.getTimestamp(7)!=null)),actor.id(),actor.id());
        var rows=data.rows().stream().map(row->{
            var config=configs.get(row.siteDb());
            var issues=bySite.getOrDefault(row.siteDb(),List.of());
            String status=issues.stream().anyMatch(i->i.eventType().equals("NO_DATA"))?"NO_DATA":issues.isEmpty()?"NORMAL":"WARNING";
            int interval=config==null?10:config.collectionIntervalMinutes(), missing=config==null?2:config.missingCollectionThreshold();
            return new com.pentaworks.monitoring.dashboard.DashboardResponse.DashboardRow(row.siteDb(),row.siteSlug(),row.name(),row.lastAt(),row.lagMin(),row.count1h(),row.count24h(),row.hePsi(),row.hePct(),row.metrics(),status,issues.size(),(int)issues.stream().filter(i->!i.acknowledged()).count(),issues,interval,missing,CollectionHealth.missedCount(row.lagMin(),interval));
        }).toList();
        Map<String,com.pentaworks.monitoring.dashboard.DashboardResponse.CtrlRange> ranges=new LinkedHashMap<>();
        for(var row:rows) {var config=configs.get(row.siteDb());if(config!=null)ranges.put(row.siteDb(),ctrl(config));}
        var old=data.stats();
        var stats=new com.pentaworks.monitoring.dashboard.DashboardResponse.Stats(old.totalSites(),old.active1h(),old.stale24h(),old.total24hRecords(),(int)rows.stream().filter(r->r.alertStatus().equals("NORMAL")).count(),(int)rows.stream().filter(r->r.alertStatus().equals("WARNING")).count(),(int)rows.stream().filter(r->r.alertStatus().equals("NO_DATA")).count(),rows.stream().mapToInt(r->r.openAlertCount()).sum());
        return new com.pentaworks.monitoring.dashboard.DashboardResponse(data.meta(),stats,rows,ranges,ranges.get("000"));
    }
    static com.pentaworks.monitoring.dashboard.DashboardResponse.CtrlRange ctrl(SiteAlertSettings s) {
        Map<String,AlertThreshold> t=new HashMap<>();if(s.alertsEnabled())s.thresholds().forEach(v->t.put(v.key(),v));
        return new com.pentaworks.monitoring.dashboard.DashboardResponse.CtrlRange(
            min(t,"recosi"),max(t,"recosi"),min(t,"coldtp"),max(t,"coldtp"),min(t,"recoru"),max(t,"recoru"),min(t,"hepres"),max(t,"hepres"),min(t,"heleve"),max(t,"heleve"),min(t,"actemp"),max(t,"actemp"),min(t,"achumi"),max(t,"achumi"),min(t,"gctemp"),max(t,"gctemp"),min(t,"gcflow"),max(t,"gcflow"),min(t,"cctemp"),max(t,"cctemp"),min(t,"ccflow"),max(t,"ccflow"));
    }
    private static Double min(Map<String,AlertThreshold> t,String key) {return t.containsKey(key)&&t.get(key).active()?t.get(key).effectiveMin():null;}
    private static Double max(Map<String,AlertThreshold> t,String key) {return t.containsKey(key)&&t.get(key).active()?t.get(key).effectiveMax():null;}

    public List<ShareTarget> targets(CurrentUser actor,String siteId) {
        users.requireSiteAccess(actor,siteId);
        return activeUsers().stream().filter(u->u.companyId()==actor.companyId()&&u.id()!=actor.id()&&users.allowedSiteIds(u).contains(siteId)).map(u->new ShareTarget(u.id(),u.name())).toList();
    }
    @Transactional
    public Share share(CurrentUser actor,String siteId,long recipientId) {
        if(targets(actor,siteId).stream().noneMatch(u->u.id()==recipientId))throw new BadRequestException("같은 회사에서 해당 병원에 접근 가능한 담당자를 선택해주세요.");
        Integer pending=jdbc.queryForObject("SELECT COUNT(*) FROM alert_pattern_share WHERE sender_id=? AND recipient_id=? AND site_id=? AND applied_at IS NULL",Integer.class,actor.id(),recipientId,siteId);
        if(pending!=null&&pending>=10)throw new BadRequestException("미적용 공유 패턴이 많습니다. 상대방이 먼저 확인해주세요.");
        jdbc.update("INSERT INTO alert_pattern_share(sender_id,recipient_id,site_id,settings_json) VALUES(?,?,?,?)",actor.id(),recipientId,siteId,encode(settings(actor,siteId)));
        long id=jdbc.queryForObject("SELECT LAST_INSERT_ID()",Long.class);
        audit.record(actor,"ALERT_PATTERN_SHARED","ALERT_PATTERN",Long.toString(id),Map.of("recipientId",recipientId,"siteId",siteId));
        return shares(actor,false).stream().filter(s->s.id()==id).findFirst().orElseThrow();
    }
    public List<Share> shares(CurrentUser actor,boolean inbox) {
        Set<String> allowed=users.allowedSiteIds(actor);
        return jdbc.query("""
            SELECT p.id,p.site_id,s.name AS site_name,u.name AS sender_name,v.name AS recipient_name,p.settings_json,p.created_at,p.applied_at
            FROM alert_pattern_share p JOIN app_user u ON u.id=p.sender_id JOIN app_user v ON v.id=p.recipient_id
            LEFT JOIN site s ON s.site=p.site_id WHERE %s=? AND u.company_id=? AND v.company_id=? ORDER BY p.id DESC LIMIT 200
            """.formatted(inbox?"p.recipient_id":"p.sender_id"),(rs,n)->new Share(rs.getLong(1),rs.getString(2),rs.getString(3),rs.getString(4),rs.getString(5),decode(rs.getString(6)),rs.getTimestamp(7).toInstant(),rs.getTimestamp(8)==null?null:rs.getTimestamp(8).toInstant()),actor.id(),actor.companyId(),actor.companyId()).stream().filter(s->allowed.contains(s.siteId())).toList();
    }
    @Transactional
    public SiteAlertSettings apply(CurrentUser actor,long id) {
        String raw=jdbc.query("""
            SELECT p.settings_json FROM alert_pattern_share p JOIN app_user u ON u.id=p.sender_id
            WHERE p.id=? AND p.recipient_id=? AND u.company_id=? FOR UPDATE
            """,rs->rs.next()?rs.getString(1):null,id,actor.id(),actor.companyId());
        if(raw==null)throw new NotFoundException("공유 패턴을 찾을 수 없습니다.");
        SiteAlertSettings snapshot=decode(raw);
        users.requireSiteAccess(actor,snapshot.siteid());
        SiteAlertSettings current=currentForUpdate(actor,snapshot.siteid());
        persist(actor,copy(snapshot,snapshot.thresholds(),snapshot.alertsEnabled()&&current.dashboardVisible(),snapshot.quietStart(),snapshot.quietEnd()));
        jdbc.update("UPDATE alert_pattern_share SET applied_at=CURRENT_TIMESTAMP(6) WHERE id=?",id);
        return settings(actor,snapshot.siteid());
    }
    public record ShareTarget(long id,String name){}
    public record Share(long id,String siteId,String siteName,String senderName,String recipientName,SiteAlertSettings settings,java.time.Instant createdAt,java.time.Instant appliedAt){}
}
