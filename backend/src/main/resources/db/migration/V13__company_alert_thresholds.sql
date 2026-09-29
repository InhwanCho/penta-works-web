CREATE TABLE company_alert_threshold (
    company_id BIGINT UNSIGNED NOT NULL,
    metric_key VARCHAR(50) NOT NULL,
    min_value DOUBLE NOT NULL,
    max_value DOUBLE NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (company_id, metric_key),
    CONSTRAINT fk_company_alert_threshold_company FOREIGN KEY (company_id) REFERENCES company (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
