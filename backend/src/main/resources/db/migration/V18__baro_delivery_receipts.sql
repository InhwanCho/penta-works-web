ALTER TABLE alert_delivery_result
    ADD COLUMN provider_receipt VARCHAR(50) NULL,
    ADD COLUMN provider_send_status INT NULL,
    ADD COLUMN provider_result_code INT NULL,
    ADD COLUMN provider_result_message VARCHAR(500) NULL,
    ADD COLUMN sms_send_state VARCHAR(120) NULL,
    ADD COLUMN provider_checked_at DATETIME(6) NULL,
    ADD COLUMN provider_final_at DATETIME(6) NULL,
    ADD KEY ix_delivery_provider_pending (provider_final_at, provider_checked_at);
