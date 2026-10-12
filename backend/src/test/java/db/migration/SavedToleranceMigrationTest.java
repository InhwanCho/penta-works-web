package db.migration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class SavedToleranceMigrationTest {
    @Test
    void updatesEveryMetricAndPreservesOtherSettingsIncludingDisabledManualMetrics() throws Exception {
        var json = new ObjectMapper();
        String source = """
            {"thresholds":[{"key":"hepres","tolerancePercent":20,"min":0.4,"max":2,"useAverage":true,"active":true},
              {"key":"cctemp","tolerancePercent":80,"useAverage":false,"active":false,"missingThreshold":3},
              {"key":"heleve","active":true}],
             "alertsEnabled":false,"quietStart":"22:00","quietEnd":"08:00","holidayDates":["2026-10-12"],"unknownField":{"keep":true}}
            """;
        var original = json.readTree(source);
        var updated = json.readTree(V32__set_saved_average_tolerances_to_50_percent.updatedSettings(source));
        for (var threshold : updated.path("thresholds")) assertEquals(50, threshold.path("tolerancePercent").asInt());
        for (var settings : new com.fasterxml.jackson.databind.JsonNode[]{original, updated})
            for (var threshold : settings.path("thresholds")) ((ObjectNode) threshold).remove("tolerancePercent");
        assertEquals(original, updated);
    }

    @Test
    void rejectsBrokenDocumentsRatherThanReplacingSettingsWithDefaults() {
        for (String source : new String[]{"broken", "{}", "{\"thresholds\":[null]}"})
            assertThrows(Exception.class, () -> V32__set_saved_average_tolerances_to_50_percent.updatedSettings(source));
    }
}
