package com.pentaworks.monitoring;

import com.pentaworks.monitoring.config.MailProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
@EnableConfigurationProperties({MrtbSyncProperties.class, MailProperties.class})
public class PentaWorksApplication {
    public static void main(String[] args) {
        SpringApplication.run(PentaWorksApplication.class, args);
    }
}
