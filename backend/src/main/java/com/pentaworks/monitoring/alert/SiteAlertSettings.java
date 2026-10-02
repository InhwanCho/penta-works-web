package com.pentaworks.monitoring.alert;

import java.time.LocalTime;
import java.time.LocalDate;
import java.util.List;

public record SiteAlertSettings(String siteid, String name, boolean configured,
                                List<AlertThreshold> thresholds, int noDataMinutes,
                                boolean noDataActive, boolean alertsEnabled,
                                int triggerAfterMinutes, int repeatMinutes,
                                LocalTime quietStart, LocalTime quietEnd,
                                boolean suppressWeekends, List<LocalDate> holidayDates,
                                boolean dashboardVisible, boolean coldChillerActive,
                                int collectionIntervalMinutes, int missingCollectionThreshold) {
    public SiteAlertSettings(String siteid, String name, boolean configured,
                             List<AlertThreshold> thresholds, int noDataMinutes,
                             boolean noDataActive, boolean alertsEnabled,
                             int triggerAfterMinutes, int repeatMinutes,
                             LocalTime quietStart, LocalTime quietEnd,
                             boolean suppressWeekends, List<LocalDate> holidayDates,
                             boolean dashboardVisible, boolean coldChillerActive) {
        this(siteid, name, configured, thresholds, noDataMinutes, noDataActive, alertsEnabled,
            triggerAfterMinutes, repeatMinutes, quietStart, quietEnd, suppressWeekends,
            holidayDates, dashboardVisible, coldChillerActive, 10, Math.max(1, (noDataMinutes + 9) / 10));
    }
    public SiteAlertSettings(String siteid, String name, boolean configured,
                             List<AlertThreshold> thresholds, int noDataMinutes,
                             boolean noDataActive, boolean alertsEnabled,
                             int triggerAfterMinutes, int repeatMinutes,
                             LocalTime quietStart, LocalTime quietEnd,
                             boolean suppressWeekends, List<LocalDate> holidayDates,
                             boolean dashboardVisible) {
        this(siteid, name, configured, thresholds, noDataMinutes, noDataActive, alertsEnabled,
            triggerAfterMinutes, repeatMinutes, quietStart, quietEnd, suppressWeekends,
            holidayDates, dashboardVisible, false);
    }
    public SiteAlertSettings(String siteid, String name, boolean configured,
                             List<AlertThreshold> thresholds, int noDataMinutes,
                             boolean noDataActive, boolean alertsEnabled,
                             int triggerAfterMinutes, int repeatMinutes,
                             LocalTime quietStart, LocalTime quietEnd,
                             boolean suppressWeekends) {
        this(siteid, name, configured, thresholds, noDataMinutes, noDataActive, alertsEnabled,
            triggerAfterMinutes, repeatMinutes, quietStart, quietEnd, suppressWeekends, List.of(), true);
    }

    public SiteAlertSettings(String siteid, String name, boolean configured,
                             List<AlertThreshold> thresholds, int noDataMinutes,
                             boolean noDataActive, boolean alertsEnabled,
                             int triggerAfterMinutes, int repeatMinutes,
                             LocalTime quietStart, LocalTime quietEnd,
                             boolean suppressWeekends, List<LocalDate> holidayDates) {
        this(siteid, name, configured, thresholds, noDataMinutes, noDataActive, alertsEnabled,
            triggerAfterMinutes, repeatMinutes, quietStart, quietEnd, suppressWeekends, holidayDates, true);
    }
}
