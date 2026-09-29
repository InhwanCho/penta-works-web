package com.pentaworks.monitoring.alert;

import java.time.LocalTime;
import java.time.LocalDate;
import java.util.List;

public record SiteAlertSettings(String siteid, String name, boolean configured,
                                List<AlertThreshold> thresholds, int noDataMinutes,
                                boolean noDataActive, boolean alertsEnabled,
                                int triggerAfterMinutes, int repeatMinutes,
                                LocalTime quietStart, LocalTime quietEnd,
                                boolean suppressWeekends, List<LocalDate> holidayDates) {
    public SiteAlertSettings(String siteid, String name, boolean configured,
                             List<AlertThreshold> thresholds, int noDataMinutes,
                             boolean noDataActive, boolean alertsEnabled,
                             int triggerAfterMinutes, int repeatMinutes,
                             LocalTime quietStart, LocalTime quietEnd,
                             boolean suppressWeekends) {
        this(siteid, name, configured, thresholds, noDataMinutes, noDataActive, alertsEnabled,
            triggerAfterMinutes, repeatMinutes, quietStart, quietEnd, suppressWeekends, List.of());
    }
}
