ALTER TABLE calendar_event_mapping ADD COLUMN payload_hash CHAR(64) NULL;
ALTER TABLE user_calendar_connection
 ADD COLUMN sync_error_code VARCHAR(64) NULL,
 ADD COLUMN synced_event_count INT NOT NULL DEFAULT 0;
