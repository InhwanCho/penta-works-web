CREATE TABLE site_operating_hours (
    site_id VARCHAR(32) PRIMARY KEY,
    settings_json LONGTEXT NOT NULL,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_by BIGINT UNSIGNED NULL
);
