package com.pentaworks.monitoring.calendar;

import com.pentaworks.monitoring.auth.CurrentUserService;
import com.pentaworks.monitoring.auth.CurrentUserService.CurrentUser;
import com.pentaworks.monitoring.common.BadRequestException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.*;
import java.util.*;
import javax.crypto.Cipher;
import javax.crypto.spec.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.*;

/** One-way projection of calendar entries visible to each connected user. */
@Service
public class GoogleCalendarSync {
 private final JdbcTemplate db; private final CurrentUserService users; private final TransactionTemplate tx;
 private final ObjectMapper json; private final RestClient http;
 @Value("${google.calendar.client-id:}") private String clientId;
 @Value("${google.calendar.client-secret:}") private String clientSecret;
 @Value("${google.calendar.encryption-key:}") private String encryptionKey;
 @Value("${google.calendar.sync-enabled:false}") private boolean enabled;
 @Value("${app.mail.public-base-url:https://app.pentaworks.net}") private String publicBase;
 public GoogleCalendarSync(JdbcTemplate db,CurrentUserService users,PlatformTransactionManager manager,ObjectMapper json){
  this.db=db;this.users=users;this.tx=new TransactionTemplate(manager);this.json=json;
  var factory=new SimpleClientHttpRequestFactory();factory.setConnectTimeout(10000);factory.setReadTimeout(15000);
  this.http=RestClient.builder().requestFactory(factory).build();
 }
 @Scheduled(fixedDelayString="${google.calendar.sync-interval-ms:60000}",initialDelay=15000)
 public void scheduled(){
  if(!enabled)return;
  for(Long id:db.queryForList("SELECT id FROM user_calendar_connection WHERE status='CONNECTED' AND provider='GOOGLE'",Long.class)){
   try{sync(id);}catch(Exception ignored){/* Persist safe error codes below; never log credentials or response bodies. */}
  }
 }
 public Map<String,Object> syncUser(CurrentUser u){
  if(!enabled)throw new BadRequestException("일정 동기화를 준비 중입니다.");
  var ids=db.queryForList("SELECT id FROM user_calendar_connection WHERE user_id=? AND company_id=? AND status='CONNECTED'",Long.class,u.id(),u.companyId());
  if(ids.isEmpty())throw new BadRequestException("구글캘린더를 먼저 연동해주세요.");
  if(!sync(ids.get(0)))throw new BadRequestException("일정을 전송하지 못했습니다. 연동 상태를 확인하고 다시 시도해주세요.");
  return Map.of("synced",true);
 }
 boolean sync(long id){
  try{return Boolean.TRUE.equals(tx.execute(status->syncLocked(id)));}
  catch(Exception e){
   String code="sync_failed";boolean reconnect=false;
   if(e instanceof RestClientResponseException re){
    code="sync_http_"+re.getStatusCode().value();
    if(re.getStatusCode().value()==401){code="reauthorization_required";reconnect=true;}
    try{if("invalid_grant".equals(json.readTree(re.getResponseBodyAsString()).path("error").asText())){code="reauthorization_required";reconnect=true;}}catch(Exception ignored){}
   }
   db.update("UPDATE user_calendar_connection SET sync_error_code=?,status=CASE WHEN ? THEN 'RECONNECT_REQUIRED' ELSE status END WHERE id=? AND status='CONNECTED'",code,reconnect,id);
   return false;
  }
 }
 private boolean syncLocked(long id){
  // Serializes sync with disconnect/reconnect. The active account and company are rechecked every run.
  var rows=db.queryForList("""
   SELECT c.*,u.email,u.name,u.role,u.status user_status FROM user_calendar_connection c
   JOIN app_user u ON u.id=c.user_id AND u.company_id=c.company_id JOIN company co ON co.id=c.company_id
   WHERE c.id=? AND c.status='CONNECTED' AND u.status='ACTIVE' AND co.status='ACTIVE' FOR UPDATE
   """,id);
  if(rows.isEmpty())return false;var c=rows.get(0);
  long company=((Number)c.get("company_id")).longValue(),user=((Number)c.get("user_id")).longValue();
  var current=new CurrentUser(user,company,c.get("email").toString(),c.get("name").toString(),c.get("role").toString(),"ACTIVE");
  var allowed=users.allowedSiteIds(current);
  var form=new LinkedMultiValueMap<String,String>();form.add("client_id",clientId);form.add("client_secret",clientSecret);
  form.add("refresh_token",decrypt(c.get("refresh_token_encrypted").toString()));form.add("grant_type","refresh_token");
  Map<?,?> token=http.post().uri("https://oauth2.googleapis.com/token").body(form).retrieve().body(Map.class);
  if(token==null||!(token.get("access_token") instanceof String access))throw new IllegalStateException("No access token");
  String calendar=c.get("calendar_id").toString();
  var schedules=db.queryForList("""
   SELECT w.*,h.name hospital_name,p.address hospital_address FROM workspace_schedule w
   LEFT JOIN workspace_hospital h ON h.company_id=w.company_id AND h.site_id=w.site_id
   LEFT JOIN site_profile p ON p.site_id=w.site_id
   WHERE w.company_id=? AND w.deleted_at IS NULL ORDER BY w.start_at,w.id
   """,company).stream().filter(r->r.get("site_id")==null||allowed.contains(r.get("site_id").toString())).toList();
  var entries=new LinkedHashMap<String,Map<String,Object>>();
  for(var schedule:schedules)entries.put("schedule:"+schedule.get("id"),event(schedule,publicBase));
  var records=db.queryForList("""
   SELECT w.*,COALESCE(h.name,s.name) hospital_name FROM workspace_record w
   LEFT JOIN workspace_hospital h ON h.company_id=w.company_id AND h.site_id=w.site_id
   LEFT JOIN site s ON s.site=w.site_id
   WHERE w.company_id=? AND w.deleted_at IS NULL ORDER BY w.work_date DESC,w.id DESC LIMIT 500
   """,company).stream().filter(r->r.get("site_id")==null||allowed.contains(r.get("site_id").toString())).toList();
  for(var r:records){
   String rid=r.get("id").toString();String type=Objects.toString(r.get("service_type"),"GENERAL");
   String label=switch(type){case "PM"->"PM";case "REPAIR"->"고장수리";case "CALL"->"콜";case "ACR"->"ACR";case "GENERAL"->"일반 업무";default->"기타";};
   String title=Objects.toString(r.get("hospital_name"),"일반 업무")+" · "+r.get("title");
   String state=switch(Objects.toString(r.get("status"),"")){case "COMPLETED"->"완료";case "REVISIT"->"재방문";default->"진행 중";};
   entries.put("record:"+rid,dayEvent("["+label+" · "+state+"] "+title,date(r.get("work_date")),Objects.toString(r.get("body"),""),"/work/"+rid,"record:"+rid,publicBase));
  }
  for(var plan:db.queryForList("""
   SELECT p.*,h.site_id,h.name hospital_name FROM workspace_hospital h
   LEFT JOIN workspace_hospital_plan p ON p.company_id=h.company_id AND p.site_id=h.site_id WHERE h.company_id=?
   """,company)){
   String site=Objects.toString(plan.get("site_id"),"");if(!allowed.contains(site))continue;
   for(String kind:List.of("pm","acr_full","acr_doc")){
    LocalDate last=date(plan.get("last_"+kind+"_date"));
    for(var r:records){
     if(!site.equals(r.get("site_id"))||!"COMPLETED".equals(r.get("status")))continue;
     String type=Objects.toString(r.get("service_type"),""),acr=Objects.toString(r.get("acr_kind"),"");
     boolean matches=kind.equals("pm")?(type.equals("PM")||Boolean.TRUE.equals(r.get("counts_as_pm"))||"1".equals(Objects.toString(r.get("counts_as_pm"),""))):type.equals("ACR")&&(acr.equals("full")||(kind.equals("acr_doc")&&acr.equals("doc")));
     LocalDate d=date(r.get("work_date"));if(matches&&d!=null&&(last==null||d.isAfter(last)))last=d;
    }
    int months=kind.equals("pm")?(plan.get("pm_interval_months") instanceof Number n?n.intValue():2):kind.equals("acr_full")?36:12;
    LocalDate due=nextDue(last,date(plan.get(kind+"_override")),months);if(due==null)continue;
    String label=kind.equals("pm")?"PM":kind.equals("acr_full")?"ACR 정밀":"ACR 서류";
    String key="due:"+site+":"+kind;
    entries.put(key,dayEvent("["+label+" 점검 예정] "+plan.get("hospital_name"),due,"점검 기준에 따라 계산된 기한입니다. 방문 일정과는 별도입니다.","/sites/"+site+"#inspection-plan",key,publicBase));
   }
  }
  var desired=entries.keySet();
  var mappings=new HashMap<String,Map<String,Object>>();
  for(var m:db.queryForList("SELECT * FROM calendar_event_mapping WHERE connection_id=?",id))mappings.put(m.get("source_key").toString(),m);
  for(var entry:entries.entrySet()){
   String sid=entry.getKey();
   Map<String,Object> payload=entry.getValue();String hash=hash(payload);
   var mapping=mappings.get(sid);
   if(mapping!=null&&hash.equals(mapping.get("payload_hash"))&&"SYNCED".equals(mapping.get("sync_status")))continue;
   String eventId=mapping==null?"mre"+digest(company+":"+id+":"+calendar+":"+sid):mapping.get("google_event_id").toString();
   if(mapping==null){
    var insert=new LinkedHashMap<>(payload);insert.put("id",eventId);
    try{http.post().uri("https://www.googleapis.com/calendar/v3/calendars/{c}/events?sendUpdates=none",calendar).header("Authorization","Bearer "+access).body(insert).retrieve().toBodilessEntity();}
    catch(HttpClientErrorException e){if(e.getStatusCode().value()!=409)throw e;update(calendar,eventId,access,payload);}
   }else update(calendar,eventId,access,payload);
   db.update("INSERT INTO calendar_event_mapping(connection_id,source_key,google_event_id,sync_status,payload_hash) VALUES(?,?,?,'SYNCED',?) ON DUPLICATE KEY UPDATE google_event_id=VALUES(google_event_id),sync_status='SYNCED',payload_hash=VALUES(payload_hash)",id,sid,eventId,hash);
  }
  for(var entry:mappings.entrySet())if(!desired.contains(entry.getKey())){
   try{http.delete().uri("https://www.googleapis.com/calendar/v3/calendars/{c}/events/{e}?sendUpdates=none",calendar,entry.getValue().get("google_event_id")).header("Authorization","Bearer "+access).retrieve().toBodilessEntity();}
   catch(HttpClientErrorException e){if(e.getStatusCode().value()!=404&&e.getStatusCode().value()!=410)throw e;}
   db.update("DELETE FROM calendar_event_mapping WHERE connection_id=? AND source_key=?",id,entry.getKey());
  }
  db.update("UPDATE user_calendar_connection SET last_synced_at=NOW(6),synced_event_count=?,sync_error_code=NULL WHERE id=?",desired.size(),id);
  return true;
 }
 private void update(String calendar,String event,String access,Map<String,Object> payload){http.put().uri("https://www.googleapis.com/calendar/v3/calendars/{c}/events/{e}?sendUpdates=none",calendar,event).header("Authorization","Bearer "+access).body(payload).retrieve().toBodilessEntity();}
 static Map<String,Object> event(Map<String,Object> s,String base){
  String label=s.get("site_id")==null?switch(Objects.toString(s.get("personal_kind"),"")){case "office"->"사무실";case "edu"->"교육·세미나";case "leave"->"휴가";case "annual"->"연차";default->"일정";}:switch(Objects.toString(s.get("service_type"),"")){case "PM"->"PM";case "REPAIR"->"고장수리";case "CALL"->"콜";case "ACR"->"ACR";case "COLDHEAD"->"콜드헤드";case "INSTALL"->"설치";default->"방문";};
  String title=Objects.toString(s.get("title"),"");String hospital=s.get("site_id")==null?"":Objects.toString(s.get("hospital_name"),"");
  String summary="["+label+"] "+(hospital.isBlank()?title:hospital+(title.isBlank()||title.equals(s.get("service_type"))||title.equals(hospital)?"":" · "+title));
  LocalDateTime start=((java.sql.Timestamp)s.get("start_at")).toLocalDateTime(),end=((java.sql.Timestamp)s.get("end_at")).toLocalDateTime();
  var event=new LinkedHashMap<String,Object>();event.put("summary",summary);
  boolean allDay=start.toLocalTime().equals(LocalTime.MIDNIGHT)&&end.toLocalTime().compareTo(LocalTime.of(23,59))>=0;
  if(allDay){event.put("start",Map.of("date",start.toLocalDate().toString()));event.put("end",Map.of("date",end.toLocalDate().plusDays(1).toString()));}
  else{event.put("start",Map.of("dateTime",start.atZone(ZoneId.of("Asia/Seoul")).toOffsetDateTime().toString(),"timeZone","Asia/Seoul"));event.put("end",Map.of("dateTime",(end.isAfter(start)?end:start.plusMinutes(1)).atZone(ZoneId.of("Asia/Seoul")).toOffsetDateTime().toString(),"timeZone","Asia/Seoul"));}
  String link=base.replaceAll("/$","")+"/schedule?date="+start.toLocalDate()+"#schedule-"+s.get("id");
  event.put("description",escape(Objects.toString(s.get("body"),""))+"\n\nMReyes에서 일정 관리: "+link);
  if(s.get("hospital_address")!=null)event.put("location",s.get("hospital_address"));
  event.put("extendedProperties",Map.of("private",Map.of("mreyesScheduleId",s.get("id").toString())));
  // No attendees or invitations. Existing MReyes alert delivery is unaffected.
  event.put("reminders",Map.of("useDefault",false));return event;
 }
 static LocalDate nextDue(LocalDate last,LocalDate override,int months){return override!=null&&(last==null||override.isAfter(last))?override:last==null?null:last.plusMonths(months);}
 private static LocalDate date(Object value){return value==null?null:LocalDate.parse(value.toString().substring(0,10));}
 static Map<String,Object> dayEvent(String title,LocalDate date,String body,String path,String key,String base){
  var result=new LinkedHashMap<String,Object>();result.put("summary",title);
  result.put("start",Map.of("date",date.toString()));result.put("end",Map.of("date",date.plusDays(1).toString()));
  result.put("description",escape(body)+"\n\nMReyes에서 보기: "+base.replaceAll("/$","")+path);
  result.put("extendedProperties",Map.of("private",Map.of("mreyesSource",key)));
  result.put("reminders",Map.of("useDefault",false));return result;
 }
 private static String escape(String text){return text.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;");}
 private String hash(Object value){try{return digest(json.writeValueAsString(value));}catch(Exception e){throw new IllegalStateException(e);}}
 private static String digest(String value){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException(e);}}
 private String decrypt(String value){try{byte[] bytes=Base64.getDecoder().decode(value);var cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,new SecretKeySpec(Base64.getDecoder().decode(encryptionKey),"AES"),new GCMParameterSpec(128,Arrays.copyOf(bytes,12)));return new String(cipher.doFinal(Arrays.copyOfRange(bytes,12,bytes.length)),StandardCharsets.UTF_8);}catch(Exception e){throw new IllegalStateException("Token unavailable");}}
}
