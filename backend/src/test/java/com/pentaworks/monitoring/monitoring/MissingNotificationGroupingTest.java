package com.pentaworks.monitoring.monitoring;

import com.pentaworks.monitoring.alert.*;
import com.pentaworks.monitoring.alert.AlertEventService.Transition;
import com.pentaworks.monitoring.dashboard.DashboardService;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class MissingNotificationGroupingTest {
    @Test
    void sendsOneMissingMessagePerRecipientAndRecordsEveryIncidentWithSameReceipt() {
        var events=mock(AlertEventService.class);var recipients=mock(AlertRecipientService.class);
        var deliveries=mock(AlertDeliveryService.class);var kakao=mock(BaroKakaoService.class);
        var monitor=new MonitorService(mock(DashboardService.class),mock(AlertService.class),events,recipients,deliveries,kakao,mock(PersonalAlertService.class),mock(RollingAverageService.class));
        var pressure=new Transition(1,"001","병원","hepres","헬륨 압력 측정 누락","회","METRIC_MISSING",5.0,null,5.0,"누락");
        var temperature=new Transition(2,"001","병원","actemp","항온항습기 온도 측정 누락","회","METRIC_MISSING",6.0,null,3.0,"누락");
        var humidity=new Transition(3,"001","병원","achumi","습도","%","HIGH",90.0,null,70.0,"이탈");
        when(recipients.personalPhones("001",7L,null)).thenReturn(List.of("01011111111","01022222222"));
        when(recipients.personalPhones("001",7L,1L)).thenReturn(List.of("01011111111","01022222222"));
        when(recipients.personalPhones("001",7L,2L)).thenReturn(List.of("01011111111"));
        when(recipients.personalPhones("001",7L,3L)).thenReturn(List.of("01011111111"));
        var b1=new AlertDeliveryService.Batch(1,"b1");var b2=new AlertDeliveryService.Batch(2,"b2");var b3=new AlertDeliveryService.Batch(3,"b3");
        when(deliveries.begin(eq(1L),anyList(),eq(false))).thenReturn(b1);
        when(deliveries.begin(eq(2L),anyList(),eq(false))).thenReturn(b2);
        when(deliveries.begin(eq(3L),anyList(),eq(false))).thenReturn(b3);
        when(deliveries.claim(any(),anyString())).thenReturn(true);
        when(kakao.sendMissing("01011111111",List.of(pressure,temperature))).thenReturn("bundle-receipt");
        when(kakao.sendMissing("01022222222",List.of(pressure))).thenReturn("single-receipt");
        when(kakao.send("01011111111",humidity)).thenReturn("range-receipt");
        monitor.sendNotifications(List.of(pressure,temperature,humidity),Map.of(),false,7);
        verify(kakao).sendMissing("01011111111",List.of(pressure,temperature));
        verify(kakao).sendMissing("01022222222",List.of(pressure));
        verify(kakao).send("01011111111",humidity);verifyNoMoreInteractions(kakao);
        verify(deliveries).accepted(b1,"KAKAO_ALIMTALK:01011111111","bundle-receipt");
        verify(deliveries).accepted(b2,"KAKAO_ALIMTALK:01011111111","bundle-receipt");
        verify(deliveries).accepted(b1,"KAKAO_ALIMTALK:01022222222","single-receipt");
        verify(deliveries).finish(b1);verify(deliveries).finish(b2);verify(deliveries).finish(b3);
    }

    @Test
    void excludedOrPreviouslySentIncidentCannotBeBundledAgainAndFailureIsRecordedForClaimedItems() {
        var recipients=mock(AlertRecipientService.class);var deliveries=mock(AlertDeliveryService.class);var kakao=mock(BaroKakaoService.class);
        var monitor=new MonitorService(mock(DashboardService.class),mock(AlertService.class),mock(AlertEventService.class),recipients,deliveries,kakao,mock(PersonalAlertService.class),mock(RollingAverageService.class));
        var first=new Transition(1,"001","병원","hepres","압력 측정 누락","회","METRIC_MISSING",5.0,null,5.0,"누락");
        var second=new Transition(2,"001","병원","actemp","온도 측정 누락","회","METRIC_MISSING",5.0,null,3.0,"누락");
        when(recipients.personalPhones(eq("001"),eq(7L),any())).thenReturn(List.of("01011111111"));
        var b1=new AlertDeliveryService.Batch(1,"b1");var b2=new AlertDeliveryService.Batch(2,"b2");
        when(deliveries.begin(eq(1L),anyList(),eq(false))).thenReturn(b1);when(deliveries.begin(eq(2L),anyList(),eq(false))).thenReturn(b2);
        when(deliveries.claim(b1,"KAKAO_ALIMTALK:01011111111")).thenReturn(false);
        when(deliveries.claim(b2,"KAKAO_ALIMTALK:01011111111")).thenReturn(true);
        when(kakao.sendMissing("01011111111",List.of(second))).thenThrow(new IllegalStateException("접수 거부"));
        monitor.sendNotifications(List.of(first,second),Map.of(),false,7);
        verify(kakao).sendMissing("01011111111",List.of(second));verifyNoMoreInteractions(kakao);
        verify(deliveries).complete(b2,"KAKAO_ALIMTALK:01011111111","FAILED","접수 거부");
        verify(deliveries,never()).complete(eq(b1),anyString(),anyString(),any());
    }
}
