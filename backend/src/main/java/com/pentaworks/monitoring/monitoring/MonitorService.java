package com.pentaworks.monitoring.monitoring;

import com.pentaworks.monitoring.alert.AlertService;
import com.pentaworks.monitoring.alert.PsiThreshold;
import com.pentaworks.monitoring.config.AppProperties;
import com.pentaworks.monitoring.dashboard.DashboardResponse;
import com.pentaworks.monitoring.dashboard.DashboardService;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
public class MonitorService {
    private final DashboardService dashboardService;
    private final AlertService alertService;
    private final AppProperties properties;
    private final RestClient restClient = RestClient.create();

    public MonitorService(DashboardService dashboardService, AlertService alertService, AppProperties properties) {
        this.dashboardService = dashboardService; this.alertService = alertService; this.properties = properties;
    }

    public Map<String, Object> run() {
        Map<String, PsiThreshold> thresholds = new LinkedHashMap<>();
        alertService.psiThresholds().forEach(value -> thresholds.put(value.siteid(), value));
        List<Map<String, Object>> alerts = new ArrayList<>();
        for (DashboardResponse.DashboardRow row : dashboardService.getDashboard().rows()) {
            PsiThreshold threshold = thresholds.get(row.siteDb());
            Double value = row.hePsi();
            if (row.name() == null || value == null || value == 0 || threshold == null || !threshold.active()) continue;
            String direction = value < nullableMin(threshold.min()) ? "low" : value > nullableMax(threshold.max()) ? "high" : null;
            if (direction == null || (threshold.min() != null && threshold.max() != null && threshold.min() > threshold.max())) continue;
            Map<String, Object> alert = new LinkedHashMap<>();
            alert.put("siteid", row.siteDb());
            alert.put("name", row.name());
            alert.put("current", value);
            alert.put("min", threshold.min());
            alert.put("max", threshold.max());
            alert.put("direction", direction);
            alerts.add(alert);
        }
        sendSlack(alerts);
        return Map.of("ok", true, "count", alerts.size(), "alerts", alerts);
    }

    private double nullableMin(Double value) { return value == null ? Double.NEGATIVE_INFINITY : value; }
    private double nullableMax(Double value) { return value == null ? Double.POSITIVE_INFINITY : value; }
    private void sendSlack(List<Map<String, Object>> alerts) {
        String webhook = properties.monitor().slackWebhookUrl();
        if (alerts.isEmpty() || webhook == null || webhook.isBlank()) return;
        String text = "[hePsi 이상 감지 " + alerts.size() + "건]";
        restClient.post().uri(webhook).contentType(MediaType.APPLICATION_JSON).body(Map.of("text", text, "alerts", alerts)).retrieve().toBodilessEntity();
    }
}
