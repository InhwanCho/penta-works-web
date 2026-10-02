package com.pentaworks.monitoring.alert;

import com.pentaworks.monitoring.common.BadRequestException;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class CollectionHealthTest {
    @Test
    void countsConsecutiveSlotsAndIncludesExactThresholdBoundary() {
        assertEquals(0L, CollectionHealth.missedCount(9L, 10));
        assertEquals(1L, CollectionHealth.missedCount(10L, 10));
        assertEquals(1L, CollectionHealth.missedCount(19L, 10));
        assertEquals(2L, CollectionHealth.missedCount(20L, 10));
        assertEquals(3L, CollectionHealth.missedCount(35L, 10));
        assertFalse(CollectionHealth.isMissing(19L, 10, 2));
        assertTrue(CollectionHealth.isMissing(20L, 10, 2));
        assertEquals(0L, CollectionHealth.missedCount(0L, 10));
    }

    @Test
    void customIntervalAndFutureTimestampAreHandled() {
        assertEquals(3L, CollectionHealth.missedCount(15L, 5));
        assertTrue(CollectionHealth.isMissing(15L, 5, 3));
        assertEquals(0L, CollectionHealth.missedCount(-10L, 10));
    }

    @Test
    void neverReceivedHasUnknownCountNotInventedMisses() {
        assertNull(CollectionHealth.missedCount(null, 10));
        assertTrue(CollectionHealth.isMissing(null, 10, 2));
        assertThrows(IllegalArgumentException.class, () -> CollectionHealth.missedCount(10L, 0));
    }

    @Test
    void validatesPolicyBoundsAndOverflow() {
        assertDoesNotThrow(() -> AlertService.validateCollectionPolicy(10, 2));
        assertDoesNotThrow(() -> AlertService.validateCollectionPolicy(5, 288));
        assertThrows(BadRequestException.class, () -> AlertService.validateCollectionPolicy(0, 2));
        assertThrows(BadRequestException.class, () -> AlertService.validateCollectionPolicy(10, 0));
        assertThrows(BadRequestException.class, () -> AlertService.validateCollectionPolicy(1440, 2));
        assertThrows(BadRequestException.class, () -> AlertService.validateCollectionPolicy(Integer.MAX_VALUE, Integer.MAX_VALUE));
    }
}
