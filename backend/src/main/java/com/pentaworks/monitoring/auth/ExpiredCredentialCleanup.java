package com.pentaworks.monitoring.auth;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class ExpiredCredentialCleanup {
    private final JdbcTemplate jdbc;

    public ExpiredCredentialCleanup(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Keep expired credentials for 30 days for incident investigation, then prune in small batches. */
    @Scheduled(cron = "0 20 3 * * *", zone = "Asia/Seoul")
    public void prune() {
        jdbc.update("""
            DELETE FROM user_session
             WHERE expires_at < CURRENT_TIMESTAMP(6) - INTERVAL 30 DAY LIMIT 1000
            """);
        jdbc.update("""
            DELETE FROM password_reset_token
             WHERE expires_at < CURRENT_TIMESTAMP(6) - INTERVAL 30 DAY LIMIT 1000
            """);
        jdbc.update("""
            DELETE FROM account_invitation
             WHERE expires_at < CURRENT_TIMESTAMP(6) - INTERVAL 30 DAY
             LIMIT 1000
            """);
    }
}
