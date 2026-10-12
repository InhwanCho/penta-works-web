package db.migration;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.flywaydb.core.api.migration.Context;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@EnabledIfEnvironmentVariable(named="MREYES_QA_DATABASE", matches="true")
class SavedToleranceMariaDbVerificationTest {
    @Test
    void updatesCompanyPersonalAndPendingSharesWithoutChangingOtherFields() throws Exception {
        var ds = new DriverManagerDataSource("jdbc:mariadb://127.0.0.1:13316/mreyes_auth_qa", "root", "local-qa-only");
        var jdbc = new JdbcTemplate(ds);
        for (String table : new String[]{"site_metric_average_policy","user_site_alert_settings","alert_pattern_share"}) jdbc.execute("DROP TABLE IF EXISTS " + table);
        jdbc.execute("CREATE TABLE site_metric_average_policy(site_id VARCHAR(32),metric_key VARCHAR(32),use_average BOOLEAN,tolerance_percent DOUBLE)");
        jdbc.execute("CREATE TABLE user_site_alert_settings(user_id BIGINT,site_id VARCHAR(32),settings_json JSON,PRIMARY KEY(user_id,site_id))");
        jdbc.execute("CREATE TABLE alert_pattern_share(id BIGINT PRIMARY KEY,settings_json JSON,applied_at DATETIME)");
        String saved = "{\"alertsEnabled\":false,\"quietStart\":\"22:00\",\"thresholds\":[{\"key\":\"hepres\",\"tolerancePercent\":20,\"min\":0.3,\"active\":false},{\"key\":\"heleve\",\"tolerancePercent\":80}]}";
        jdbc.update("INSERT INTO site_metric_average_policy VALUES('001','hepres',FALSE,20),('002','heleve',TRUE,80)");
        jdbc.update("INSERT INTO user_site_alert_settings VALUES(7,'001',?),(8,'002',?)",saved,saved);
        jdbc.update("INSERT INTO alert_pattern_share VALUES(1,?,NULL),(2,?,'2026-10-12')",saved,saved);
        try (var connection = ds.getConnection()) {
            connection.setAutoCommit(false);
            var context = mock(Context.class); when(context.getConnection()).thenReturn(connection);
            new V32__set_saved_average_tolerances_to_50_percent().migrate(context);
            connection.commit();
        }
        assertEquals(2,jdbc.queryForObject("SELECT COUNT(*) FROM site_metric_average_policy WHERE tolerance_percent=50",Integer.class));
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM site_metric_average_policy WHERE use_average=FALSE",Integer.class));
        assertEquals(2,jdbc.queryForObject("SELECT COUNT(*) FROM user_site_alert_settings WHERE JSON_EXTRACT(settings_json,'$.thresholds[0].tolerancePercent')=50 AND JSON_EXTRACT(settings_json,'$.thresholds[1].tolerancePercent')=50 AND JSON_EXTRACT(settings_json,'$.alertsEnabled')=false AND JSON_EXTRACT(settings_json,'$.thresholds[0].min')=0.3",Integer.class));
        assertEquals(50,jdbc.queryForObject("SELECT JSON_EXTRACT(settings_json,'$.thresholds[0].tolerancePercent') FROM alert_pattern_share WHERE id=1",Integer.class));
        assertEquals(saved,jdbc.queryForObject("SELECT settings_json FROM alert_pattern_share WHERE id=2",String.class));
    }
}
