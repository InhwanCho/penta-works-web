CREATE TABLE site_alert_policy (
    site_id VARCHAR(32) NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    trigger_after_minutes INT UNSIGNED NOT NULL DEFAULT 0,
    repeat_minutes INT UNSIGNED NOT NULL DEFAULT 0,
    quiet_start TIME NULL,
    quiet_end TIME NULL,
    suppress_weekends BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (site_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE alert_pending_state (
    rule_id BIGINT UNSIGNED NOT NULL,
    event_type VARCHAR(30) NOT NULL,
    first_seen_at DATETIME(6) NOT NULL,
    last_seen_at DATETIME(6) NOT NULL,
    PRIMARY KEY (rule_id),
    CONSTRAINT fk_alert_pending_rule FOREIGN KEY (rule_id)
        REFERENCES alert_rule (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE site_alert_holiday (
    site_id VARCHAR(32) NOT NULL,
    holiday_date DATE NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (site_id, holiday_date),
    KEY ix_alert_holiday_date (holiday_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE alert_event
    ADD COLUMN last_notified_at DATETIME(6) NULL AFTER delivery_error,
    ADD COLUMN notification_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER last_notified_at;

CREATE INDEX ix_alert_event_delivery ON alert_event (delivery_status, occurred_at);
