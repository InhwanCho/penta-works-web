package com.pentaworks.monitoring.alert;
import org.junit.jupiter.api.Test;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
class SiteOperatingHoursTest {
 final ZoneId zone=ZoneId.of("Asia/Seoul");
 SiteOperatingHours policy(String holiday,Map<LocalDate,SiteOperatingHours.Window> exceptions) {
  var d=SiteOperatingHours.defaults();return new SiteOperatingHours(true,d.days(),holiday,d.holidayWindow(),exceptions,10);
 }
 SiteOperatingHours.Status at(SiteOperatingHours p,String time,LocalDate...holidays){return p.status(LocalDateTime.parse(time).atZone(zone),Set.of(holidays));}
 @Test void defaultsNeverInterruptExistingMonitoring(){assertTrue(at(SiteOperatingHours.defaults(),"2026-10-18T02:00").monitoring());}
 @Test void openingGraceAndClosingBoundaries(){var p=policy("WEEKDAY",Map.of());
  assertFalse(at(p,"2026-10-16T08:59").monitoring());assertFalse(at(p,"2026-10-16T09:09").monitoring());
  assertTrue(at(p,"2026-10-16T09:10").monitoring());assertTrue(at(p,"2026-10-16T17:59").monitoring());assertFalse(at(p,"2026-10-16T18:00").monitoring());
  assertEquals(LocalDateTime.parse("2026-10-17T09:10").atZone(zone).toInstant(),at(p,"2026-10-16T18:00").nextMonitoringAt());}
 @Test void saturdayCanOpenWhileSundayCloses(){var p=policy("WEEKDAY",Map.of());assertTrue(at(p,"2026-10-17T12:00").monitoring());assertFalse(at(p,"2026-10-17T13:00").monitoring());assertFalse(at(p,"2026-10-18T12:00").monitoring());}
 @Test void holidaysFollowWeekdayByDefaultAndCanHaveCustomHours(){var holiday=LocalDate.of(2026,12,25);
  assertTrue(at(policy("WEEKDAY",Map.of()),"2026-12-25T15:00",holiday).monitoring());
  assertFalse(at(policy("CLOSED",Map.of()),"2026-12-25T12:00",holiday).monitoring());
  assertTrue(at(policy("CUSTOM",Map.of()),"2026-12-25T12:00",holiday).monitoring());assertFalse(at(policy("CUSTOM",Map.of()),"2026-12-25T14:00",holiday).monitoring());}
 @Test void dateExceptionOverridesHolidayAndWeekday(){var holiday=LocalDate.of(2026,12,25);var closed=new SiteOperatingHours.Window(true,false,null,null);
  assertFalse(at(policy("WEEKDAY",Map.of(holiday,closed)),"2026-12-25T12:00",holiday).monitoring());
  assertTrue(at(policy("CLOSED",Map.of(holiday,new SiteOperatingHours.Window(false,true,null,null))),"2026-12-25T02:00",holiday).monitoring());}
 @Test void overnightScheduleBelongsToStartingDay(){var base=policy("WEEKDAY",Map.of());var days=new EnumMap<DayOfWeek,SiteOperatingHours.Window>(DayOfWeek.class);days.putAll(base.days());days.put(DayOfWeek.FRIDAY,new SiteOperatingHours.Window(false,false,LocalTime.of(22,0),LocalTime.of(6,0)));
  var p=new SiteOperatingHours(true,days,"WEEKDAY",base.holidayWindow(),Map.of(),10);
  assertTrue(at(p,"2026-10-17T02:00").monitoring());assertFalse(at(p,"2026-10-17T06:00").monitoring());assertFalse(at(p,"2026-10-16T22:09").monitoring());
  var exception=new SiteOperatingHours(true,days,"WEEKDAY",base.holidayWindow(),Map.of(LocalDate.of(2026,10,17),new SiteOperatingHours.Window(true,false,null,null)),10);
  assertFalse(at(exception,"2026-10-17T02:00").monitoring());}
 @Test void invalidWindowsAndTooLongGraceAreRejected(){var d=SiteOperatingHours.defaults();assertThrows(RuntimeException.class,()->new SiteOperatingHours(true,Map.of(),"WEEKDAY",d.holidayWindow(),Map.of(),10));
  assertThrows(RuntimeException.class,()->new SiteOperatingHours(true,d.days(),"WEEKDAY",new SiteOperatingHours.Window(false,false,LocalTime.of(9,0),LocalTime.of(9,5)),Map.of(),10));}
 @Test void jsonRoundTripAndBundledHolidaysAreAvailableOffline()throws Exception{var json=new com.fasterxml.jackson.databind.ObjectMapper().findAndRegisterModules();var p=policy("CUSTOM",Map.of(LocalDate.of(2026,10,19),new SiteOperatingHours.Window(true,false,null,null)));assertEquals(p,json.readValue(json.writeValueAsString(p),SiteOperatingHours.class));var calendar=new KoreanPublicHolidays(json);assertTrue(calendar.dates().containsKey(LocalDate.of(2026,12,25)));assertTrue(calendar.dates().containsKey(LocalDate.of(2026,10,5)));}
 @Test void calendarParserHandlesFoldedLines(){assertEquals("대체공휴일",KoreanPublicHolidays.parse("BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20261005\r\nSUMMARY:대체공\r\n 휴일\r\nEND:VEVENT").get(LocalDate.of(2026,10,5)));}
 @Test void membersCannotChangeSharedSchedule(){var jdbc=org.mockito.Mockito.mock(org.springframework.jdbc.core.JdbcTemplate.class);var service=new SiteOperatingHoursService(jdbc,new com.fasterxml.jackson.databind.ObjectMapper(),org.mockito.Mockito.mock(com.pentaworks.monitoring.auth.CurrentUserService.class),org.mockito.Mockito.mock(com.pentaworks.monitoring.admin.AuditService.class),org.mockito.Mockito.mock(KoreanPublicHolidays.class));
  var member=new com.pentaworks.monitoring.auth.CurrentUserService.CurrentUser(1,1,"a@b.com","담당자","USER","ACTIVE");assertThrows(com.pentaworks.monitoring.common.ForbiddenException.class,()->service.save(member,"001",SiteOperatingHours.defaults()));org.mockito.Mockito.verifyNoInteractions(jdbc);}
}
