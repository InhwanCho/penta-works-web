package com.pentaworks.monitoring.site;

import java.util.List;

public record SiteResponse(String slug, SiteSummary site, int take, String lastAt, List<Measurement> rows,
                           List<com.pentaworks.monitoring.company.CompanyMetricService.Metric> metricConfig,
                           int page, long totalCount) {
    public SiteResponse(String slug, SiteSummary site, int take, String lastAt, List<Measurement> rows) {
        this(slug, site, take, lastAt, rows, List.of(), 1, rows.size());
    }
    public SiteResponse withMetrics(List<com.pentaworks.monitoring.company.CompanyMetricService.Metric> metrics) {
        return new SiteResponse(slug, site, take, lastAt, rows, metrics, page, totalCount);
    }
    public record SiteSummary(String siteDb, String name) {}
    public record Measurement(int index, String date, Double hepres, Double heleve, Double actemp, Double achumi,
        Double recosi, Double coldtp, Double recoru, Double gctemp, Double gcflow, Double cctemp, Double ccflow) {}
}
