-- Only change defaults: retain explicit existing opt-outs and alert enablement.
ALTER TABLE site_alert_policy MODIFY COLUMN cold_chiller_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE site_metric_average_policy MODIFY COLUMN use_average BOOLEAN NOT NULL DEFAULT TRUE;
