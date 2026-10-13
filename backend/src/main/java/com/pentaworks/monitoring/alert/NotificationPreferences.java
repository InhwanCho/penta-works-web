package com.pentaworks.monitoring.alert;

import java.time.LocalTime;
import java.time.LocalDate;
import java.util.List;
import com.pentaworks.monitoring.common.BadRequestException;

/** Delivery preferences owned by the authenticated member, independent of hospital rules. */
public record NotificationPreferences(int repeatMinutes, LocalTime quietStart, LocalTime quietEnd,
                                      boolean suppressWeekends, List<LocalDate> holidayDates) {
    public NotificationPreferences {
        if (repeatMinutes < 0 || repeatMinutes > 10080 || repeatMinutes > 0 && repeatMinutes < 5)
            throw new BadRequestException("반복 간격은 처음 한 번 또는 5분에서 10080분 사이로 설정해주세요.");
        if ((quietStart == null) != (quietEnd == null) || quietStart != null && quietStart.equals(quietEnd))
            throw new BadRequestException("쉬는 시간의 시작과 종료를 서로 다르게 입력해주세요.");
        if (holidayDates == null || holidayDates.size() > 100 || holidayDates.stream().anyMatch(java.util.Objects::isNull))
            throw new BadRequestException("알림 쉬는 날짜는 최대 100일입니다.");
        holidayDates = holidayDates.stream().distinct().sorted().toList();
    }
    static NotificationPreferences from(SiteAlertSettings s) {
        return new NotificationPreferences(s.repeatMinutes(), s.quietStart(), s.quietEnd(), s.suppressWeekends(), s.holidayDates());
    }
    SiteAlertSettings apply(SiteAlertSettings s) {
        return new SiteAlertSettings(s.siteid(),s.name(),s.configured(),s.thresholds(),s.noDataMinutes(),s.noDataActive(),s.alertsEnabled(),
            s.triggerAfterMinutes(),repeatMinutes,quietStart,quietEnd,suppressWeekends,holidayDates,s.dashboardVisible(),
            s.coldChillerActive(),s.collectionIntervalMinutes(),s.missingCollectionThreshold());
    }
}
