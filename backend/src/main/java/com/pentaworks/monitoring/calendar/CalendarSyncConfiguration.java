package com.pentaworks.monitoring.calendar;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class CalendarSyncConfiguration {
    @Bean(destroyMethod = "shutdown")
    public ExecutorService calendarSyncExecutor() {
        return Executors.newSingleThreadExecutor(task -> {
            Thread thread = new Thread(task, "google-calendar-sync");
            thread.setDaemon(true);
            return thread;
        });
    }
}
