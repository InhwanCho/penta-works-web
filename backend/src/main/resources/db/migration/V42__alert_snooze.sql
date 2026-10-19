CREATE TABLE alert_snooze (
 rule_id BIGINT UNSIGNED NOT NULL,
 event_type VARCHAR(32) NOT NULL,
 until_at DATETIME(6) NOT NULL,
 PRIMARY KEY (rule_id,event_type),
 CONSTRAINT fk_alert_snooze_rule FOREIGN KEY(rule_id) REFERENCES alert_rule(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
