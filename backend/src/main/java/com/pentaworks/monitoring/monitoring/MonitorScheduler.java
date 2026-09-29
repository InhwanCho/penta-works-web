package com.pentaworks.monitoring.monitoring;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "app.monitor.scheduler-enabled", havingValue = "true")
public class MonitorScheduler {
    private static final Logger log = LoggerFactory.getLogger(MonitorScheduler.class);
    private final MonitorService monitorService;

    public MonitorScheduler(MonitorService monitorService) {
        this.monitorService = monitorService;
    }

    @Scheduled(fixedDelayString = "${app.monitor.interval-ms:60000}",
               initialDelayString = "${app.monitor.initial-delay-ms:60000}")
    public void evaluate() {
        try {
            monitorService.run();
        } catch (RuntimeException error) {
            log.error("Scheduled alert evaluation failed", error);
        }
    }
}
