ALTER TABLE password_reset_token MODIFY COLUMN created_by BIGINT UNSIGNED NULL;

CREATE TABLE password_reset_request_limit (
    email_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    window_started_at DATETIME(6) NOT NULL,
    last_requested_at DATETIME(6) NOT NULL,
    request_count INT UNSIGNED NOT NULL,
    PRIMARY KEY (email_hash),
    KEY ix_password_reset_request_age (last_requested_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
