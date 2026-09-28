-- One rule per site/metric keeps monitor runs idempotent and lets open events
-- serialize on the rule row before a new event is created.
CREATE UNIQUE INDEX IF NOT EXISTS uq_alert_rule_site_metric_type
    ON alert_rule (site_id, metric_key, rule_type);

CREATE INDEX IF NOT EXISTS ix_alert_event_rule_open
    ON alert_event (rule_id, recovered_at, event_type);
