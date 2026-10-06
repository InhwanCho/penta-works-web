CREATE TABLE user_site_alert_settings (
 user_id BIGINT UNSIGNED NOT NULL,
 site_id VARCHAR(32) NOT NULL,
 settings_json JSON NOT NULL,
 updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
 PRIMARY KEY (user_id,site_id),
 CONSTRAINT fk_personal_alert_user FOREIGN KEY(user_id) REFERENCES app_user(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
ALTER TABLE alert_rule ADD COLUMN user_id BIGINT UNSIGNED NOT NULL DEFAULT 0;
DROP INDEX uq_alert_rule_site_metric_type ON alert_rule;
CREATE UNIQUE INDEX uq_alert_rule_user_site_metric_type ON alert_rule(user_id,site_id,metric_key,rule_type);
CREATE TABLE alert_pattern_share (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 sender_id BIGINT UNSIGNED NOT NULL,
 recipient_id BIGINT UNSIGNED NOT NULL,
 site_id VARCHAR(32) NOT NULL,
 settings_json JSON NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 applied_at DATETIME(6) NULL,
 PRIMARY KEY(id), KEY ix_pattern_inbox(recipient_id,created_at),
 CONSTRAINT fk_pattern_sender FOREIGN KEY(sender_id) REFERENCES app_user(id) ON DELETE CASCADE,
 CONSTRAINT fk_pattern_recipient FOREIGN KEY(recipient_id) REFERENCES app_user(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- Historical shared incidents remain available. New incidents use a personal rule.
UPDATE alert_event e JOIN alert_rule r ON r.id=e.rule_id
 SET e.recovered_at=CURRENT_TIMESTAMP(6)
 WHERE r.user_id=0 AND e.recovered_at IS NULL;
DELETE p FROM alert_pending_state p JOIN alert_rule r ON r.id=p.rule_id WHERE r.user_id=0;
