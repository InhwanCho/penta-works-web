package com.pentaworks.monitoring.site;

import java.util.List;

public record SiteResponse(String slug, SiteSummary site, int take, String lastAt, List<Measurement> rows,
                           List<com.pentaworks.monitoring.company.CompanyMetricService.Metric> metricConfig,
                           int page, long totalCount,Long hospitalId,String monitoringSiteId,Boolean monitoringConnected) {
    public SiteResponse(String slug, SiteSummary site, int take, String lastAt, List<Measurement> rows) {
        this(slug, site, take, lastAt, rows, List.of(), 1, rows.size(),null,null,null);
    }
    public SiteResponse(String slug,SiteSummary site,int take,String lastAt,List<Measurement> rows,List<com.pentaworks.monitoring.company.CompanyMetricService.Metric> metricConfig,int page,long totalCount) {
        this(slug,site,take,lastAt,rows,metricConfig,page,totalCount,null,null,null);
    }
    public SiteResponse withHospital(Long hospitalId,String monitoringSiteId,String name) {
        return new SiteResponse(slug,name==null?site:new SiteSummary(site.siteDb(),name),take,lastAt,rows,metricConfig,page,totalCount,hospitalId,monitoringSiteId,monitoringSiteId!=null);
    }
    public SiteResponse withMetrics(List<com.pentaworks.monitoring.company.CompanyMetricService.Metric> metrics) {
        return new SiteResponse(slug, site, take, lastAt, rows, metrics, page, totalCount,hospitalId,monitoringSiteId,monitoringConnected);
    }
    public record SiteSummary(String siteDb, String name) {}
    public record Measurement(int index, String date, Double hepres, Double heleve, Double actemp, Double achumi,
        Double recosi, Double coldtp, Double recoru, Double gctemp, Double gcflow, Double cctemp, Double ccflow) {}
}
