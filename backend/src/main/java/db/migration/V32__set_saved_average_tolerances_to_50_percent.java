package db.migration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.sql.Connection;
import java.util.ArrayList;
import java.util.List;
import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

/** One-time user-requested change; all other alert settings remain intact. */
public class V32__set_saved_average_tolerances_to_50_percent extends BaseJavaMigration {
    private static final ObjectMapper JSON = new ObjectMapper();

    @Override
    public void migrate(Context context) throws Exception {
        Connection connection = context.getConnection();
        List<Personal> personal = new ArrayList<>();
        List<Shared> pendingShares = new ArrayList<>();
        // Validate every document before changing any persisted setting.
        try (var statement = connection.prepareStatement("SELECT user_id,site_id,settings_json FROM user_site_alert_settings");
             var rows = statement.executeQuery()) {
            while (rows.next()) personal.add(new Personal(rows.getLong(1), rows.getString(2), updatedSettings(rows.getString(3))));
        }
        try (var statement = connection.prepareStatement("SELECT id,settings_json FROM alert_pattern_share WHERE applied_at IS NULL");
             var rows = statement.executeQuery()) {
            while (rows.next()) pendingShares.add(new Shared(rows.getLong(1), updatedSettings(rows.getString(2))));
        }
        try (var statement = connection.prepareStatement("UPDATE site_metric_average_policy SET tolerance_percent=50")) {
            statement.executeUpdate();
        }
        try (var statement = connection.prepareStatement("UPDATE user_site_alert_settings SET settings_json=? WHERE user_id=? AND site_id=?")) {
            for (Personal item : personal) {
                statement.setString(1, item.json()); statement.setLong(2, item.userId()); statement.setString(3, item.siteId());
                statement.addBatch();
            }
            if (!personal.isEmpty()) statement.executeBatch();
        }
        try (var statement = connection.prepareStatement("UPDATE alert_pattern_share SET settings_json=? WHERE id=? AND applied_at IS NULL")) {
            for (Shared item : pendingShares) {
                statement.setString(1, item.json()); statement.setLong(2, item.id()); statement.addBatch();
            }
            if (!pendingShares.isEmpty()) statement.executeBatch();
        }
    }

    static String updatedSettings(String source) throws Exception {
        JsonNode settings = JSON.readTree(source);
        if (!(settings instanceof ObjectNode) || !settings.path("thresholds").isArray())
            throw new IllegalArgumentException("Saved alert settings have no threshold list");
        for (JsonNode threshold : settings.path("thresholds")) {
            if (!(threshold instanceof ObjectNode object)) throw new IllegalArgumentException("Invalid saved threshold");
            object.put("tolerancePercent", 50);
        }
        return JSON.writeValueAsString(settings);
    }

    private record Personal(long userId, String siteId, String json) {}
    private record Shared(long id, String json) {}
}
