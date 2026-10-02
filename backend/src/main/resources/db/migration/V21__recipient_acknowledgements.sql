CREATE TABLE alert_event_acknowledgement (
    event_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    acknowledged_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (event_id,user_id),
    CONSTRAINT fk_event_ack_event FOREIGN KEY (event_id) REFERENCES alert_event(id) ON DELETE CASCADE,
    CONSTRAINT fk_event_ack_user FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE site_alert_policy MODIFY repeat_minutes INT UNSIGNED NOT NULL DEFAULT 30;
UPDATE site_alert_policy SET repeat_minutes=30 WHERE repeat_minutes=0;
