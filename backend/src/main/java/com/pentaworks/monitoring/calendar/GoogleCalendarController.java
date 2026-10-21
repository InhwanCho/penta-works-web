package com.pentaworks.monitoring.calendar;

import com.pentaworks.monitoring.auth.CurrentUserService;
import com.pentaworks.monitoring.common.BadRequestException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.*;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.util.UriComponentsBuilder;

@RestController
@RequestMapping("/api/v1/integrations/google-calendar")
public class GoogleCalendarController {
 private final JdbcTemplate db;
 private final CurrentUserService users;
 private final RestClient http;
 @org.springframework.beans.factory.annotation.Autowired private GoogleCalendarSync sync;
 private final SecureRandom random=new SecureRandom();
 @Value("${google.calendar.client-id:}") private String clientId;
 @Value("${google.calendar.client-secret:}") private String clientSecret;
 @Value("${google.calendar.encryption-key:}") private String encryptionKey;
 @Value("${google.calendar.redirect-uri:}") private String redirectUri;
 private final org.springframework.context.ApplicationEventPublisher changes;
 public GoogleCalendarController(JdbcTemplate db,CurrentUserService users,org.springframework.context.ApplicationEventPublisher changes) {
  this.changes=changes;
  this.db=db;this.users=users;
  var factory=new SimpleClientHttpRequestFactory();factory.setConnectTimeout(10000);factory.setReadTimeout(15000);
  http=RestClient.builder().requestFactory(factory).build();
 }
 private boolean configured(){
  try {return !clientId.isBlank()&&!clientSecret.isBlank()&&Base64.getDecoder().decode(encryptionKey).length==32
   && URI.create(redirectUri).getScheme().equals("https");}catch(Exception e){return false;}
 }
 @GetMapping
 public Map<String,Object> status(Authentication auth){
  var u=users.require(auth);
  var rows=db.queryForList("SELECT status,calendar_id,last_error_code,sync_error_code,last_synced_at,synced_event_count FROM user_calendar_connection WHERE user_id=? AND company_id=? AND provider='GOOGLE'",u.id(),u.companyId());
  String status=rows.isEmpty()?"DISCONNECTED":rows.get(0).get("status").toString();
  var result=new LinkedHashMap<String,Object>();result.put("configured",configured());result.put("status",status);result.put("connected",status.equals("CONNECTED"));
  var row=rows.isEmpty()?Map.<String,Object>of():rows.get(0);
  result.put("errorCode",Objects.toString(row.get("last_error_code"),""));
  result.put("syncError",Objects.toString(row.get("sync_error_code"),""));
  result.put("lastSyncedAt",Objects.toString(row.get("last_synced_at"),""));
  result.put("syncedEventCount",row.getOrDefault("synced_event_count",0));return result;
 }
 @PostMapping("/sync")
 public Map<String,Object> sync(Authentication auth){return sync.syncUser(users.require(auth));}
 @PostMapping("/connect")
 @Transactional
 public Map<String,String> connect(Authentication auth,HttpServletResponse response){
  var u=users.require(auth);if(!configured())throw new BadRequestException("구글캘린더 연결을 준비 중입니다.");
  db.update("INSERT INTO user_calendar_connection(company_id,user_id) VALUES(?,?) ON DUPLICATE KEY UPDATE company_id=VALUES(company_id)",u.companyId(),u.id());
  Long id=db.queryForObject("SELECT id FROM user_calendar_connection WHERE user_id=? AND company_id=? FOR UPDATE",Long.class,u.id(),u.companyId());
  db.update("DELETE FROM calendar_oauth_state WHERE connection_id=? OR expires_at<NOW()",id);
  String state=nonce(),browser=nonce();
  db.update("INSERT INTO calendar_oauth_state(state_hash,browser_hash,connection_id,expires_at) VALUES(?,?,?,DATE_ADD(NOW(),INTERVAL 10 MINUTE))",hash(state),hash(browser),id);
  cookie(response,browser,600);
  String url=UriComponentsBuilder.fromUriString("https://accounts.google.com/o/oauth2/v2/auth")
   .queryParam("client_id",clientId).queryParam("redirect_uri",redirectUri).queryParam("response_type","code")
   .queryParam("scope","https://www.googleapis.com/auth/calendar.app.created").queryParam("access_type","offline")
   .queryParam("prompt","consent").queryParam("state",state).build().encode().toUriString();
  return Map.of("url",url);
 }
 @GetMapping("/callback")
 @Transactional
 public void callback(@RequestParam(required=false) String state,@RequestParam(required=false) String code,
  @RequestParam(required=false) String error,HttpServletRequest request,HttpServletResponse response)throws java.io.IOException {
  String outcome="failed";String reason="invalid_state";
  String browser="";if(request.getCookies()!=null)for(var c:request.getCookies())if(c.getName().equals("mreyes_calendar_oauth"))browser=c.getValue();
  if(configured()&&state!=null&&!browser.isBlank()) {
   var rows=db.queryForList("SELECT s.connection_id,c.calendar_id,c.user_id,c.company_id FROM calendar_oauth_state s JOIN user_calendar_connection c ON c.id=s.connection_id JOIN app_user u ON u.id=c.user_id AND u.company_id=c.company_id JOIN company co ON co.id=c.company_id WHERE s.state_hash=? AND s.browser_hash=? AND s.expires_at>NOW() AND u.status='ACTIVE' AND co.status='ACTIVE' FOR UPDATE",hash(state),hash(browser));
   if(!rows.isEmpty()) {
    var row=rows.get(0);Object id=row.get("connection_id");db.update("DELETE FROM calendar_oauth_state WHERE state_hash=?",hash(state));
    if(error!=null)outcome="cancelled";
    else if(code!=null){String stage="token";try {
     var form=new LinkedMultiValueMap<String,String>();form.add("code",code);form.add("client_id",clientId);form.add("client_secret",clientSecret);form.add("redirect_uri",redirectUri);form.add("grant_type","authorization_code");
     Map<?,?> token=http.post().uri("https://oauth2.googleapis.com/token").body(form).retrieve().body(Map.class);
     if(token==null||!(token.get("refresh_token") instanceof String refresh)||refresh.isBlank()||!(token.get("access_token") instanceof String access))throw new IllegalStateException("missing_token");
     stage="calendar";String calendarId=null;
     // Reuse the app calendar only if the newly authorized account can access it.
     if(row.get("calendar_id") instanceof String old)try {
      var existing=http.get().uri("https://www.googleapis.com/calendar/v3/calendars/{id}",old).header("Authorization","Bearer "+access).retrieve().body(Map.class);
      if(existing!=null)calendarId=old;
     }catch(org.springframework.web.client.HttpClientErrorException e){if(e.getStatusCode().value()!=404&&e.getStatusCode().value()!=403)throw e;}
     if(calendarId==null){
      Map<?,?> calendar=http.post().uri("https://www.googleapis.com/calendar/v3/calendars").header("Authorization","Bearer "+access)
       .body(Map.of("summary","MReyes 업무 일정","timeZone","Asia/Seoul")).retrieve().body(Map.class);
      if(calendar==null||calendar.get("id")==null)throw new IllegalStateException();calendarId=calendar.get("id").toString();
     }
     if(!Objects.equals(calendarId,row.get("calendar_id")))db.update("DELETE FROM calendar_event_mapping WHERE connection_id=?",id);
     db.update("UPDATE user_calendar_connection SET calendar_id=?,refresh_token_encrypted=?,status='CONNECTED',last_error_code=NULL WHERE id=?",calendarId,encrypt(refresh),id);
     changes.publishEvent(new CalendarChanged(((Number)row.get("company_id")).longValue()));
     outcome="connected";
    }catch(Exception e){
     outcome="failed";reason=stage+"_failed";
     if(e instanceof org.springframework.web.client.RestClientResponseException re){
      reason=stage+"_http_"+re.getStatusCode().value();
      // Read only a known error reason; never persist or log the Google response or token.
      try {
       var json=new com.fasterxml.jackson.databind.ObjectMapper().readTree(re.getResponseBodyAsString());
       String googleReason=json.path("error").path("errors").path(0).path("reason").asText("");
       if(Set.of("accessNotConfigured","insufficientPermissions","forbidden","rateLimitExceeded","dailyLimitExceeded").contains(googleReason))reason=googleReason;
       for(var detail:json.path("error").path("details"))if("SERVICE_DISABLED".equals(detail.path("reason").asText()))reason="accessNotConfigured";
      }catch(Exception ignored){}
     }else if("missing_token".equals(e.getMessage()))reason="missing_token";
     db.update("UPDATE user_calendar_connection SET last_error_code=? WHERE id=?",reason,id);
    }} // Never log Google responses, authorization codes or tokens.
   }
  }
  cookie(response,"",0);response.setHeader("Cache-Control","no-store");response.setHeader("Referrer-Policy","no-referrer");
  // Keep the redirect relative so reverse proxies cannot expose the backend origin/port.
  response.setStatus(302);response.setHeader("Location","/settings?googleCalendar="+outcome+("failed".equals(outcome)?"&calendarError="+reason:"")+"#google-calendar");
 }
 @DeleteMapping
 @Transactional
 public Map<String,Boolean> disconnect(Authentication auth){
  var u=users.require(auth);
  var rows=db.queryForList("SELECT id FROM user_calendar_connection WHERE user_id=? AND company_id=? FOR UPDATE",u.id(),u.companyId());
  if(!rows.isEmpty()){
   Object id=rows.get(0).get("id");db.update("DELETE FROM calendar_oauth_state WHERE connection_id=?",id);
   db.update("UPDATE user_calendar_connection SET refresh_token_encrypted=NULL,status='DISCONNECTED',last_error_code=NULL WHERE id=?",id);
  }
  // Existing Google events remain; clearing the token stops this application's access.
  return Map.of("disconnected",true);
 }
 private void cookie(HttpServletResponse r,String value,long age){r.addHeader("Set-Cookie",ResponseCookie.from("mreyes_calendar_oauth",value).httpOnly(true).secure(true).sameSite("Lax").path("/api/v1/integrations/google-calendar").maxAge(Duration.ofSeconds(age)).build().toString());}
 private String nonce(){byte[] b=new byte[32];random.nextBytes(b);return Base64.getUrlEncoder().withoutPadding().encodeToString(b);}
 private String hash(String value){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException(e);}}
 private String encrypt(String value){try{
  byte[] iv=new byte[12];random.nextBytes(iv);Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
  cipher.init(Cipher.ENCRYPT_MODE,new SecretKeySpec(Base64.getDecoder().decode(encryptionKey),"AES"),new GCMParameterSpec(128,iv));
  byte[] encrypted=cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));byte[] combined=new byte[iv.length+encrypted.length];System.arraycopy(iv,0,combined,0,iv.length);System.arraycopy(encrypted,0,combined,iv.length,encrypted.length);return Base64.getEncoder().encodeToString(combined);
 }catch(Exception e){throw new IllegalStateException("Calendar encryption failed");}}
}
