package com.pentaworks.monitoring.dashboard;

import java.util.List;
import java.util.Map;

public record DashboardResponse(Meta meta, Stats stats, List<DashboardRow> rows,
                                Map<String, CtrlRange> ctrl, CtrlRange ctrlDefault) {
    public record Meta(long nowMs, long since1hMs, long since24hMs) {}
    public record Stats(int totalSites, int active1h, int stale24h, int total24hRecords) {}
    public record DashboardRow(String siteDb, String siteSlug, String name, String lastAt, Long lagMin,
                               int count1h, int count24h, Double hePsi, Double hePct,
                               Map<String, Double> metrics) {}
    public record CtrlRange(Double mrplel, Double mrpleh, Double mrlevl, Double mrlevh,
                            Double actmpl, Double actmph, Double achuml, Double achumh,
                            Double gctmpl, Double gctmph, Double gcflol, Double gcfloh,
                            Double cctmpl, Double cctmph, Double ccflol, Double ccfloh) {}
}
