CREATE TABLE site_metric_average_hourly (
    site_id VARCHAR(32) NOT NULL,
    metric_key VARCHAR(50) NOT NULL,
    captured_at DATETIME(6) NOT NULL,
    last_sample_at DATETIME(6) NULL,
    average_value DOUBLE NULL,
    sample_count INT UNSIGNED NOT NULL,
    zero_count INT UNSIGNED NOT NULL,
    PRIMARY KEY (site_id, metric_key, captured_at),
    KEY ix_metric_average_latest (captured_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE site_metric_average_policy (
    site_id VARCHAR(32) NOT NULL,
    metric_key VARCHAR(50) NOT NULL,
    use_average BOOLEAN NOT NULL DEFAULT FALSE,
    tolerance_percent DOUBLE NOT NULL DEFAULT 20,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (site_id, metric_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
