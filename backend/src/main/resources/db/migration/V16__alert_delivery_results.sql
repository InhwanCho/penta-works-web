ALTER TABLE alert_event
    ADD COLUMN delivery_batch_id CHAR(36) NULL,
    ADD COLUMN delivery_started_at DATETIME(6) NULL,
    ADD COLUMN threshold_min DOUBLE NULL,
    ADD COLUMN threshold_max DOUBLE NULL;

CREATE TABLE alert_delivery_result (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    event_id BIGINT UNSIGNED NOT NULL,
    batch_id CHAR(36) NOT NULL,
    recipient_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    recipient_label VARCHAR(80) NOT NULL,
    channel VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
    error_message VARCHAR(500) NULL,
    started_at DATETIME(6) NULL,
    finished_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_delivery_target (event_id,batch_id,recipient_key),
    CONSTRAINT fk_delivery_event FOREIGN KEY (event_id) REFERENCES alert_event(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
