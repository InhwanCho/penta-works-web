package com.pentaworks.monitoring.monitoring;

import com.pentaworks.monitoring.common.UnauthorizedException;
import com.pentaworks.monitoring.config.AppProperties;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/monitor")
public class MonitorController {
    private final MonitorService monitorService;
    private final AppProperties properties;
    public MonitorController(MonitorService monitorService, AppProperties properties) {
        this.monitorService = monitorService; this.properties = properties;
    }

    @GetMapping
    public Map<String, Object> run(HttpServletRequest request) {
        String expected = properties.monitor().cronSecret();
        if (expected == null || expected.isBlank() || !("Bearer " + expected).equals(request.getHeader("Authorization"))) {
            throw new UnauthorizedException("Unauthorized");
        }
        return monitorService.run();
    }
}
