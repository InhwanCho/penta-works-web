package com.pentaworks.monitoring.dashboard;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class DashboardMeasurementTest {
    @Test
    void parsesOnlyMeasuredMrtbValues() {
        for (String unmeasured : new String[] {"0", "0.000", "0.001", "0.01", "0.010", "0.1", "0.100", "-0.1", "-3258.2"}) {
            assertNull(DashboardService.parseMeasurement(unmeasured));
        }
        assertNull(DashboardService.parseMeasurement(null));
        assertEquals(0.011, DashboardService.parseMeasurement("0.011"));
        assertEquals(304.57, DashboardService.parseMeasurement("304.570 K"));
        assertEquals(0.0, DashboardService.parseNumber("0"));
    }
    @Test
    void rejectsBrokenNumbersWithoutGuessingDecimalPositions() {
        for (String invalid : new String[] {"2" + (char) 14 + "385", "0930", "2 385", "2abc385", "1,234", "NaN", "Infinity", "1e3", "1.2.3", "2.3\t", "2385junk"}) {
            assertNull(DashboardService.parseNumber(invalid), invalid);
        }
        assertEquals(2.285, DashboardService.parseMeasurement("2.285"));
        assertEquals(0.930, DashboardService.parseMeasurement("0.930"));
        assertEquals(2385.0, DashboardService.parseMeasurement("2385")); // Do not hide a valid high reading.
        assertEquals(2.3, DashboardService.parseMeasurement(" 2.3 psi "));
        assertEquals(0.93, DashboardService.parseMeasurement(".930"));
    }
}
