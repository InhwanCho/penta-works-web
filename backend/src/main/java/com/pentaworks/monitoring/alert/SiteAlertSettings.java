package com.pentaworks.monitoring.alert;

import java.util.List;

public record SiteAlertSettings(String siteid, String name, boolean configured,
                                List<AlertThreshold> thresholds, int noDataMinutes,
                                boolean noDataActive) {}
