package com.pentaworks.monitoring.site;

import java.util.List;

public record SiteResponse(String slug, SiteSummary site, int take, String lastAt, List<Measurement> rows) {
    public record SiteSummary(String siteDb, String name) {}
    public record Measurement(int index, String date, Double hepres, Double heleve, Double actemp, Double achumi) {}
}
