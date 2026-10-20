ALTER TABLE calendar_event_mapping MODIFY schedule_id BIGINT NULL, ADD COLUMN source_key VARCHAR(160) NULL;
UPDATE calendar_event_mapping SET source_key=CONCAT('schedule:',schedule_id);
ALTER TABLE calendar_event_mapping MODIFY source_key VARCHAR(160) NOT NULL, ADD UNIQUE KEY uq_calendar_source(connection_id,source_key);
