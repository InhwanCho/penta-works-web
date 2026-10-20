package com.pentaworks.monitoring.calendar;
import org.junit.jupiter.api.Test;
import java.util.*;
import java.sql.Timestamp;
import static org.junit.jupiter.api.Assertions.*;
class GoogleCalendarSyncTest {
 Map<String,Object> schedule(String start,String end){
  var s=new HashMap<String,Object>();s.put("id",6L);s.put("site_id","015");s.put("hospital_name","S신경1");s.put("service_type","REPAIR");s.put("title","REPAIR");s.put("start_at",Timestamp.valueOf(start));s.put("end_at",Timestamp.valueOf(end));s.put("body","보드 <확인>");return s;
 }
 @Test void allDayAndInclusiveMultipleDaysBecomeExclusiveGoogleEnd(){
  var e=GoogleCalendarSync.event(schedule("2026-10-14 00:00:00","2026-10-15 23:59:59"),"https://app.example.com");
  assertEquals(Map.of("date","2026-10-14"),e.get("start"));assertEquals(Map.of("date","2026-10-16"),e.get("end"));
  assertEquals("[고장수리] S신경1",e.get("summary"));assertFalse(e.containsKey("attendees"));assertEquals(Map.of("useDefault",false),e.get("reminders"));
 }
 @Test void timedEventUsesKoreaOffsetAndEscapesDescription(){
  var e=GoogleCalendarSync.event(schedule("2026-10-27 09:00:00","2026-10-27 10:00:00"),"https://app.example.com/");
  assertEquals(Map.of("dateTime","2026-10-27T09:00+09:00","timeZone","Asia/Seoul"),e.get("start"));
  assertTrue(e.get("description").toString().contains("&lt;확인&gt;"));assertTrue(e.get("description").toString().contains("https://app.example.com/schedule?date=2026-10-27"));
 }
 @Test void vacationAndAnnualLeaveStaySeparate(){
  var s=schedule("2026-10-14 00:00:00","2026-10-14 23:59:59");s.remove("site_id");s.put("title","홍길동");s.put("personal_kind","leave");
  assertEquals("[휴가] 홍길동",GoogleCalendarSync.event(s,"https://app.example.com").get("summary"));
  s.put("personal_kind","annual");assertEquals("[연차] 홍길동",GoogleCalendarSync.event(s,"https://app.example.com").get("summary"));
 }
 @Test void deadlinesUseSameOverrideAndMonthEndRulesAsOverview(){
  var last=java.time.LocalDate.of(2026,8,31);
  assertEquals(java.time.LocalDate.of(2026,10,31),GoogleCalendarSync.nextDue(last,null,2));
  assertEquals(java.time.LocalDate.of(2026,10,21),GoogleCalendarSync.nextDue(last,java.time.LocalDate.of(2026,10,21),2));
  assertEquals(java.time.LocalDate.of(2026,10,31),GoogleCalendarSync.nextDue(last,last,2));
  assertNull(GoogleCalendarSync.nextDue(null,null,2));
 }
 @Test void recordLinksAndAllDayEndAreSpecific(){
  var e=GoogleCalendarSync.dayEvent("기록",java.time.LocalDate.of(2026,10,20),"내용","/work/219","record:219","https://app.example.com/");
  assertEquals(Map.of("date","2026-10-21"),e.get("end"));
  assertTrue(e.get("description").toString().endsWith("https://app.example.com/work/219"));
  assertTrue(GoogleCalendarSync.event(schedule("2026-10-21 00:00:00","2026-10-21 23:59:59"),"https://app.example.com").get("description").toString().endsWith("#schedule-6"));
 }
}
