ALTER TABLE alert_event_acknowledgement ADD COLUMN repeat_until DATETIME(6) NULL;
UPDATE alert_event_acknowledgement SET repeat_until=DATE_ADD(acknowledged_at, INTERVAL 24 HOUR);
-- Preserve any explicitly chosen pause instead of shortening it to the default.
UPDATE alert_event_acknowledgement a
JOIN alert_event e ON e.id=a.event_id
JOIN alert_rule r ON r.id=e.rule_id AND r.user_id=a.user_id
JOIN alert_snooze z ON z.rule_id=e.rule_id AND z.event_type=e.event_type
SET a.repeat_until=z.until_at;
