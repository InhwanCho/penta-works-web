package com.pentaworks.monitoring.alert;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/** Refreshes provider outcomes without resending notifications. */
@Service
public class BaroDeliveryStatusService {
    private static final Logger log = LoggerFactory.getLogger(BaroDeliveryStatusService.class);
    private final AlertDeliveryService deliveries;
    private final BaroKakaoService kakao;

    public BaroDeliveryStatusService(AlertDeliveryService deliveries, BaroKakaoService kakao) {
        this.deliveries = deliveries;
        this.kakao = kakao;
    }

    @Scheduled(fixedDelay = 60000, initialDelay = 60000)
    public void refresh() {
        if (!kakao.ready()) return;
        for (AlertDeliveryService.ProviderReceipt receipt : deliveries.pendingProviderReceipts()) {
            try {
                deliveries.recordProviderStatus(receipt, kakao.lookup(receipt.value()));
            } catch (RuntimeException error) {
                log.warn("Barobill delivery status lookup failed for result {}", receipt.id());
            }
        }
    }
}
