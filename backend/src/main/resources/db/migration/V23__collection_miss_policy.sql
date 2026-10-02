ALTER TABLE site_alert_policy
 ADD COLUMN collection_interval_minutes INT NOT NULL DEFAULT 10,
 ADD COLUMN missing_collection_threshold INT NOT NULL DEFAULT 2;

-- Preserve non-default legacy interruption settings, rounding up to a collection slot.
UPDATE site_alert_policy p JOIN alert_rule r ON r.site_id=p.site_id
 AND r.metric_key='__data__' AND r.rule_type='NO_DATA'
SET p.missing_collection_threshold=GREATEST(1,CEIL(r.no_data_minutes/10.0))
WHERE r.no_data_minutes IS NOT NULL AND r.no_data_minutes<>30;

-- Rules without a site policy may exist in older installations.
INSERT INTO site_alert_policy (site_id,collection_interval_minutes,missing_collection_threshold)
SELECT r.site_id,10,IF(r.no_data_minutes IS NULL OR r.no_data_minutes=30,2,GREATEST(1,CEIL(r.no_data_minutes/10.0)))
FROM alert_rule r WHERE r.metric_key='__data__' AND r.rule_type='NO_DATA'
 AND NOT EXISTS (SELECT 1 FROM site_alert_policy p WHERE p.site_id=r.site_id);
