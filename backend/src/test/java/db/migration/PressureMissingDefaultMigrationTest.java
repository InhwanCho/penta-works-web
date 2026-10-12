package db.migration;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class PressureMissingDefaultMigrationTest {
    @Test
    void updatesOnlyOldPressureDefaultsAndPreservesOtherMetricsAndCustomCounts() throws Exception {
        var json=new ObjectMapper();
        String source="""
            {"alertsEnabled":false,"missingCollectionThreshold":2,"quietStart":"22:00","thresholds":[
             {"key":"hepres","missingThreshold":3,"missingActive":false,"tolerancePercent":50,"min":0.5},
             {"key":"heleve","missingThreshold":3,"missingActive":false}]}
            """;
        var updated=json.readTree(V33__default_helium_pressure_missing_to_five.updatedSettings(source));
        assertEquals(5,updated.path("thresholds").get(0).path("missingThreshold").asInt());
        assertTrue(updated.path("thresholds").get(0).path("missingActive").asBoolean());
        assertEquals(2,updated.path("missingCollectionThreshold").asInt());
        assertFalse(updated.path("alertsEnabled").asBoolean());
        assertEquals("22:00",updated.path("quietStart").asText());
        assertEquals(json.readTree(source).path("thresholds").get(1),updated.path("thresholds").get(1));
        var legacy=json.readTree(V33__default_helium_pressure_missing_to_five.updatedSettings("{\"thresholds\":[{\"key\":\"hepres\"}]}"));
        assertEquals(5,legacy.path("thresholds").get(0).path("missingThreshold").asInt());
        assertTrue(legacy.path("thresholds").get(0).path("missingActive").asBoolean());
        String custom="{\"thresholds\":[{\"key\":\"hepres\",\"missingThreshold\":10,\"missingActive\":false}]}";
        assertEquals(json.readTree(custom),json.readTree(V33__default_helium_pressure_missing_to_five.updatedSettings(custom)));
    }
}
