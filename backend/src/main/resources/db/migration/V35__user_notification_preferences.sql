CREATE TABLE user_notification_preferences (
    user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    settings_json LONGTEXT NOT NULL,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_notification_preferences_user FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE
);
