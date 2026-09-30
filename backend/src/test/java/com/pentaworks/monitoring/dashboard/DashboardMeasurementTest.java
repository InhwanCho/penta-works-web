package com.pentaworks.monitoring.dashboard;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class DashboardMeasurementTest {
    @Test
    void parsesOnlyMeasuredMrtbValues() {
        for (String unmeasured : new String[] {"0", "0.000", "0.001", "0.01", "0.010"}) {
            assertNull(DashboardService.parseMeasurement(unmeasured));
        }
        assertNull(DashboardService.parseMeasurement(null));
        assertEquals(0.011, DashboardService.parseMeasurement("0.011"));
        assertEquals(304.57, DashboardService.parseMeasurement("304.570 K"));
        assertEquals(0.0, DashboardService.parseNumber("0"));
    }
}
