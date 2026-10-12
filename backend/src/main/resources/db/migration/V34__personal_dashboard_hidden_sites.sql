CREATE TABLE user_dashboard_hidden_site (
    user_id BIGINT UNSIGNED NOT NULL,
    site_id VARCHAR(32) NOT NULL,
    PRIMARY KEY (user_id, site_id),
    CONSTRAINT fk_dashboard_hidden_user FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
