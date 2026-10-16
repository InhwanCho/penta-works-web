package com.pentaworks.monitoring.alert;

import com.pentaworks.monitoring.common.BadRequestException;
import java.time.*;
import java.util.*;

public record SiteOperatingHours(boolean enabled, Map<DayOfWeek,Window> days, String holidayMode,
                                 Window holidayWindow, Map<LocalDate,Window> exceptions, int graceMinutes) {
    public record Window(boolean closed, boolean allDay, LocalTime start, LocalTime end) {
        void validate() {
            if(!closed && !allDay && (start==null || end==null || start.equals(end)))
                throw new BadRequestException("운영 시작·종료 시간을 다르게 입력하세요. 24시간은 별도로 선택하세요.");
        }
    }
    public SiteOperatingHours {
        if(days==null || days.size()!=7 || days.keySet().stream().anyMatch(Objects::isNull)
            || days.values().stream().anyMatch(Objects::isNull)) throw new BadRequestException("모든 요일의 운영 시간을 입력하세요.");
        if(!Set.of("WEEKDAY","CUSTOM","CLOSED").contains(holidayMode==null?"":holidayMode)) throw new BadRequestException("공휴일 운영 방식을 확인하세요.");
        if(holidayWindow==null || exceptions==null || exceptions.size()>100 || exceptions.entrySet().stream().anyMatch(e->e.getKey()==null||e.getValue()==null))
            throw new BadRequestException("날짜별 예외는 최대 100일입니다.");
        if(graceMinutes<0 || graceMinutes>120) throw new BadRequestException("감시 유예 시간은 0~120분입니다.");
        days.values().forEach(Window::validate); holidayWindow.validate();exceptions.values().forEach(Window::validate);
        var windows=new ArrayList<>(days.values());windows.add(holidayWindow);windows.addAll(exceptions.values());
        for(var w:windows) if(!w.closed()&&!w.allDay()) {
            long length=Duration.between(w.start(),w.end()).toMinutes();if(length<=0)length+=1440;
            if(length<=graceMinutes)throw new BadRequestException("감시 유예 시간은 운영 시간보다 짧아야 합니다.");
        }
        days=Map.copyOf(days);exceptions=Map.copyOf(exceptions);
    }
    public static SiteOperatingHours defaults() {
        Map<DayOfWeek,Window> days=new EnumMap<>(DayOfWeek.class);
        for(var day:DayOfWeek.values())days.put(day,new Window(day==DayOfWeek.SUNDAY,false,LocalTime.of(9,0),day==DayOfWeek.SATURDAY?LocalTime.of(13,0):LocalTime.of(18,0)));
        return new SiteOperatingHours(false,days,"WEEKDAY",new Window(false,false,LocalTime.of(9,0),LocalTime.of(13,0)),Map.of(),10);
    }
    Window window(LocalDate date, Set<LocalDate> holidays) {
        if(exceptions.containsKey(date)) return exceptions.get(date);
        if(holidays.contains(date)) {
            if(holidayMode.equals("CLOSED"))return new Window(true,false,null,null);
            if(holidayMode.equals("CUSTOM"))return holidayWindow;
        }
        return days.get(date.getDayOfWeek());
    }
    public record Status(boolean enabled, boolean monitoring, String label, Instant sessionStart,
                         Instant monitoringStart, Instant nextMonitoringAt) {}
    public Status status(ZonedDateTime value,Set<LocalDate> holidays) {
        var now=value.withZoneSameInstant(ZoneId.of("Asia/Seoul"));
        if(!enabled)return new Status(false,true,"24시간 감시",null,null,null);
        for(int offset=exceptions.containsKey(now.toLocalDate())?0:-1;offset<=0;offset++) {
            var date=now.toLocalDate().plusDays(offset);var w=window(date,holidays);
            if(w.closed())continue;
            var start=w.allDay()?date.atStartOfDay(now.getZone()):date.atTime(w.start()).atZone(now.getZone());
            var end=w.allDay()?date.plusDays(1).atStartOfDay(now.getZone()):date.plusDays(w.end().isAfter(w.start())?0:1).atTime(w.end()).atZone(now.getZone());
            if(!now.isBefore(start) && now.isBefore(end)) {
                var watch=w.allDay()?start:start.plusMinutes(graceMinutes);
                if(!watch.isBefore(end))continue;
                return new Status(true,!now.isBefore(watch),now.isBefore(watch)?"감시 준비 중":"운영시간 내",start.toInstant(),watch.toInstant(),now.isBefore(watch)?watch.toInstant():null);
            }
        }
        Instant next=null;
        for(int offset=0;offset<=370;offset++) {
            var date=now.toLocalDate().plusDays(offset);var w=window(date,holidays);if(w.closed())continue;
            var start=w.allDay()?date.atStartOfDay(now.getZone()):date.atTime(w.start()).atZone(now.getZone()).plusMinutes(graceMinutes);
            var end=w.allDay()?date.plusDays(1).atStartOfDay(now.getZone()):date.plusDays(w.end().isAfter(w.start())?0:1).atTime(w.end()).atZone(now.getZone());
            if(start.isAfter(now)&&start.isBefore(end)){next=start.toInstant();break;}
        }
        return new Status(true,false,"운영시간 외",null,null,next);
    }
}
