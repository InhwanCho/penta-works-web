package com.pentaworks.monitoring.alert;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.*;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;
import org.springframework.scheduling.annotation.Scheduled;

/** Public-holidays-only feed; bundled snapshot keeps scheduling independent of network access. */
@Service
public class KoreanPublicHolidays {
    public static final String SOURCE="https://calendar.google.com/calendar/ical/ko.south_korea.official%23holiday%40group.v.calendar.google.com/public/basic.ics";
    private volatile Map<LocalDate,String> dates;
    public KoreanPublicHolidays(ObjectMapper json) throws java.io.IOException {
        try(var in=getClass().getResourceAsStream("/calendar/kr-holidays.json")) {
            Map<String,String> saved=json.readValue(in,new TypeReference<>(){});
            var parsed=new TreeMap<LocalDate,String>();saved.forEach((d,n)->parsed.put(LocalDate.parse(d),n));dates=Map.copyOf(parsed);
        }
    }
    public Map<LocalDate,String> dates(){return dates;}
    @Scheduled(initialDelay=60000,fixedDelay=86400000)
    public void refresh() {
        try {
            var client=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
            var response=client.send(HttpRequest.newBuilder(URI.create(SOURCE)).timeout(Duration.ofSeconds(8)).GET().build(),HttpResponse.BodyHandlers.ofString());
            if(response.statusCode()!=200 || response.body().length()>2000000)return;
            var parsed=parse(response.body());
            if(parsed.size()>50 && parsed.keySet().stream().anyMatch(d->d.getYear()==LocalDate.now(ZoneId.of("Asia/Seoul")).getYear()))dates=Map.copyOf(parsed);
        }catch(InterruptedException e){Thread.currentThread().interrupt();}
        catch(Exception e){org.slf4j.LoggerFactory.getLogger(getClass()).warn("Public holiday refresh failed; retaining bundled/last successful calendar");}
    }
    static Map<LocalDate,String> parse(String body) {
        var result=new TreeMap<LocalDate,String>();
        for(String event:body.replaceAll("\\r?\\n[ \\t]","").split("BEGIN:VEVENT")) {
            var date=Pattern.compile("(?m)^DTSTART;VALUE=DATE:(\\d{8})").matcher(event);
            var title=Pattern.compile("(?m)^SUMMARY:([^\\r\\n]+)").matcher(event);
            if(date.find()&&title.find())result.put(LocalDate.parse(date.group(1),DateTimeFormatter.BASIC_ISO_DATE),title.group(1));
        }return result;
    }
}
