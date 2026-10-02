package com.pentaworks.monitoring.dashboard;

import java.util.List;
import java.util.Map;

public record DashboardResponse(Meta meta, Stats stats, List<DashboardRow> rows,
                                Map<String, CtrlRange> ctrl, CtrlRange ctrlDefault,
                                List<com.pentaworks.monitoring.company.CompanyMetricService.Metric> metricConfig) {
    public DashboardResponse(Meta meta, Stats stats, List<DashboardRow> rows, Map<String, CtrlRange> ctrl, CtrlRange ctrlDefault) {
        this(meta, stats, rows, ctrl, ctrlDefault, List.of());
    }
    public DashboardResponse withMetrics(List<com.pentaworks.monitoring.company.CompanyMetricService.Metric> metrics) {
        return new DashboardResponse(meta, stats, rows, ctrl, ctrlDefault, metrics);
    }
    public record Meta(long nowMs, long since1hMs, long since24hMs) {}
    public record Stats(int totalSites, int active1h, int stale24h, int total24hRecords,
                        int normalSites, int warningSites, int noDataSites, int openAlerts) {}
    public record DashboardRow(String siteDb, String siteSlug, String name, String lastAt, Long lagMin,
                               int count1h, int count24h, Double hePsi, Double hePct,
                               Map<String, Double> metrics, String alertStatus, int openAlertCount,
                               int unacknowledgedAlertCount, List<AlertIssue> alertIssues,
                               int collectionIntervalMinutes, int missingCollectionThreshold,
                               Long missedCollectionCount) {
        public DashboardRow(String siteDb, String siteSlug, String name, String lastAt, Long lagMin,
                            int count1h, int count24h, Double hePsi, Double hePct, Map<String, Double> metrics,
                            String alertStatus, int openAlertCount, int unacknowledgedAlertCount, List<AlertIssue> alertIssues) {
            this(siteDb, siteSlug, name, lastAt, lagMin, count1h, count24h, hePsi, hePct, metrics,
                alertStatus, openAlertCount, unacknowledgedAlertCount, alertIssues, 10, 2,
                com.pentaworks.monitoring.alert.CollectionHealth.missedCount(lagMin, 10));
        }
    }
    public record AlertIssue(long id, String metricKey, String eventType, String message,
                             String occurredAt, boolean acknowledged) {}
    public record CtrlRange(Double recosil, Double recosih, Double coldtpl, Double coldtph,
                            Double recorul, Double recoruh,
                            Double mrplel, Double mrpleh, Double mrlevl, Double mrlevh,
                            Double actmpl, Double actmph, Double achuml, Double achumh,
                            Double gctmpl, Double gctmph, Double gcflol, Double gcfloh,
                            Double cctmpl, Double cctmph, Double ccflol, Double ccfloh) {}
}
