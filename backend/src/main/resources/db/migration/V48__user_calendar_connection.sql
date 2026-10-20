CREATE TABLE user_calendar_connection (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 company_id BIGINT UNSIGNED NOT NULL,
 user_id BIGINT UNSIGNED NOT NULL,
 provider VARCHAR(20) NOT NULL DEFAULT 'GOOGLE',
 calendar_id VARCHAR(255) NULL,
 refresh_token_encrypted TEXT NULL,
 status VARCHAR(30) NOT NULL DEFAULT 'DISCONNECTED',
 last_synced_at DATETIME(6) NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
 UNIQUE KEY uq_user_calendar_provider(user_id,provider),
 FOREIGN KEY(company_id) REFERENCES company(id),
 FOREIGN KEY(user_id) REFERENCES app_user(id)
);
CREATE TABLE calendar_oauth_state (
 state_hash CHAR(64) PRIMARY KEY,
 browser_hash CHAR(64) NOT NULL,
 connection_id BIGINT UNSIGNED NOT NULL,
 expires_at DATETIME(6) NOT NULL,
 FOREIGN KEY(connection_id) REFERENCES user_calendar_connection(id) ON DELETE CASCADE
);
CREATE TABLE calendar_event_mapping (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 connection_id BIGINT UNSIGNED NOT NULL,
 schedule_id BIGINT NOT NULL,
 google_event_id VARCHAR(255) NOT NULL,
 sync_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
 updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
 UNIQUE KEY uq_calendar_schedule(connection_id,schedule_id),
 FOREIGN KEY(schedule_id) REFERENCES workspace_schedule(id),
 FOREIGN KEY(connection_id) REFERENCES user_calendar_connection(id) ON DELETE CASCADE
);
