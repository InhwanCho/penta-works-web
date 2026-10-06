-- Change only the default for new policies; preserve saved tolerance settings.
ALTER TABLE site_metric_average_policy MODIFY COLUMN tolerance_percent DOUBLE NOT NULL DEFAULT 30;
