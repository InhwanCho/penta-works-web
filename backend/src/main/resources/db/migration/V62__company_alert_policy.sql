CREATE TABLE company_notification_policy (
    company_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    revision BIGINT NOT NULL DEFAULT 0,
    settings_json LONGTEXT NOT NULL,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_company_notification_policy FOREIGN KEY (company_id) REFERENCES company(id)
);
