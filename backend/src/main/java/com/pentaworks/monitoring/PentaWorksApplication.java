package com.pentaworks.monitoring;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
@EnableConfigurationProperties(MrtbSyncProperties.class)
public class PentaWorksApplication {
    public static void main(String[] args) {
        SpringApplication.run(PentaWorksApplication.class, args);
    }
}
