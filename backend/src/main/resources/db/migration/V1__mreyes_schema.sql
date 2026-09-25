-- MREyes application schema
-- Existing legacy tables `site` and `mrtb` are intentionally left unchanged.
-- Site references are indexed but are not declared as physical foreign keys until
-- the legacy `site.site` datatype/collation is verified in the target database.

CREATE TABLE IF NOT EXISTS COMPANY (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(64) NOT NULL,
    name VARCHAR(120) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_company_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS COMPANY_SITE (
    company_id BIGINT UNSIGNED NOT NULL,
    site_id VARCHAR(32) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (company_id, site_id),
    UNIQUE KEY uq_company_site_site (site_id),
    CONSTRAINT fk_company_site_company FOREIGN KEY (company_id) REFERENCES COMPANY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS SITE_PROFILE (
    site_id VARCHAR(32) NOT NULL,
    display_name VARCHAR(120) NULL,
    address VARCHAR(255) NULL,
    contact_name VARCHAR(80) NULL,
    contact_phone VARCHAR(30) NULL,
    timezone VARCHAR(40) NOT NULL DEFAULT 'Asia/Seoul',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (site_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS COMPANY_METRIC_CONFIG (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    company_id BIGINT UNSIGNED NOT NULL,
    metric_key VARCHAR(50) NOT NULL,
    display_name VARCHAR(80) NOT NULL,
    unit VARCHAR(20) NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_visible BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_company_metric (company_id, metric_key),
    CONSTRAINT fk_metric_company FOREIGN KEY (company_id) REFERENCES COMPANY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS APP_USER (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    company_id BIGINT UNSIGNED NOT NULL,
    username VARCHAR(80) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(80) NOT NULL,
    phone VARCHAR(30) NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'USER',
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    failed_login_count INT UNSIGNED NOT NULL DEFAULT 0,
    locked_until DATETIME(6) NULL,
    password_changed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_app_user_username (username),
    KEY ix_app_user_company (company_id),
    CONSTRAINT fk_app_user_company FOREIGN KEY (company_id) REFERENCES COMPANY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS USER_SITE (
    user_id BIGINT UNSIGNED NOT NULL,
    site_id VARCHAR(32) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (user_id, site_id),
    KEY ix_user_site_site (site_id),
    CONSTRAINT fk_user_site_user FOREIGN KEY (user_id) REFERENCES APP_USER (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS SITE_ALERT_RECIPIENT (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    site_id VARCHAR(32) NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    channel VARCHAR(20) NOT NULL,
    destination VARCHAR(120) NOT NULL,
    priority INT NOT NULL DEFAULT 0,
    quiet_start TIME NULL,
    quiet_end TIME NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_site_recipient (site_id, user_id, channel, destination),
    KEY ix_site_recipient_user (user_id),
    CONSTRAINT fk_site_recipient_user FOREIGN KEY (user_id) REFERENCES APP_USER (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS USER_SESSION (
    id CHAR(36) NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    refresh_token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    device_name VARCHAR(120) NULL,
    ip_address VARCHAR(45) NULL,
    last_used_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    expires_at DATETIME(6) NOT NULL,
    revoked_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_user_session_token (refresh_token_hash),
    KEY ix_user_session_user (user_id),
    KEY ix_user_session_expiry (expires_at, revoked_at),
    CONSTRAINT fk_user_session_user FOREIGN KEY (user_id) REFERENCES APP_USER (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS AUDIT_LOG (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    company_id BIGINT UNSIGNED NOT NULL,
    actor_user_id BIGINT UNSIGNED NULL,
    actor_name VARCHAR(80) NOT NULL,
    action VARCHAR(60) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id VARCHAR(100) NULL,
    before_data JSON NULL,
    after_data JSON NULL,
    ip_address VARCHAR(45) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY ix_audit_company_created (company_id, created_at),
    KEY ix_audit_actor_created (actor_user_id, created_at),
    KEY ix_audit_target (target_type, target_id),
    CONSTRAINT fk_audit_company FOREIGN KEY (company_id) REFERENCES COMPANY (id),
    CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES APP_USER (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS OFFICE_INTEGRATION (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    company_id BIGINT UNSIGNED NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DISABLED',
    base_url VARCHAR(255) NOT NULL,
    credential_ref VARCHAR(255) NOT NULL,
    last_success_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_office_integration_company (company_id),
    CONSTRAINT fk_office_integration_company FOREIGN KEY (company_id) REFERENCES COMPANY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS OFFICE_ASSET_SYNC_STATE (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    integration_id BIGINT UNSIGNED NOT NULL,
    site_id VARCHAR(32) NOT NULL,
    entity_type VARCHAR(30) NOT NULL,
    sync_cursor VARCHAR(255) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'IDLE',
    last_synced_at DATETIME(6) NULL,
    last_source_at DATETIME(6) NULL,
    error_message TEXT NULL,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_asset_sync_state (integration_id, site_id, entity_type),
    KEY ix_asset_sync_site (site_id),
    CONSTRAINT fk_asset_sync_integration FOREIGN KEY (integration_id) REFERENCES OFFICE_INTEGRATION (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS OFFICE_SYNC_RUN (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    integration_id BIGINT UNSIGNED NOT NULL,
    trigger_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    started_at DATETIME(6) NOT NULL,
    finished_at DATETIME(6) NULL,
    equipment_count INT UNSIGNED NOT NULL DEFAULT 0,
    component_count INT UNSIGNED NOT NULL DEFAULT 0,
    maintenance_count INT UNSIGNED NOT NULL DEFAULT 0,
    error_message TEXT NULL,
    PRIMARY KEY (id),
    KEY ix_sync_run_integration_started (integration_id, started_at),
    CONSTRAINT fk_sync_run_integration FOREIGN KEY (integration_id) REFERENCES OFFICE_INTEGRATION (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS EQUIPMENT (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    office_id VARCHAR(100) NOT NULL,
    site_id VARCHAR(32) NOT NULL,
    name VARCHAR(120) NOT NULL,
    equipment_type VARCHAR(50) NOT NULL,
    manufacturer VARCHAR(100) NULL,
    model VARCHAR(100) NULL,
    serial_number VARCHAR(100) NULL,
    installed_at DATE NULL,
    status VARCHAR(20) NOT NULL,
    source_updated_at DATETIME(6) NOT NULL,
    synced_at DATETIME(6) NOT NULL,
    deleted_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_equipment_office_id (office_id),
    KEY ix_equipment_site_status (site_id, status),
    KEY ix_equipment_sync (synced_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS EQUIPMENT_COMPONENT (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    office_id VARCHAR(100) NOT NULL,
    equipment_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(120) NOT NULL,
    component_type VARCHAR(50) NOT NULL,
    part_number VARCHAR(100) NULL,
    serial_number VARCHAR(100) NULL,
    installed_at DATE NULL,
    replaced_at DATE NULL,
    status VARCHAR(20) NOT NULL,
    source_updated_at DATETIME(6) NOT NULL,
    synced_at DATETIME(6) NOT NULL,
    deleted_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_component_office_id (office_id),
    KEY ix_component_equipment_status (equipment_id, status),
    CONSTRAINT fk_component_equipment FOREIGN KEY (equipment_id) REFERENCES EQUIPMENT (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS MAINTENANCE_HISTORY (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    office_id VARCHAR(100) NOT NULL,
    equipment_id BIGINT UNSIGNED NOT NULL,
    component_id BIGINT UNSIGNED NULL,
    target_type VARCHAR(20) NOT NULL,
    maintenance_type VARCHAR(50) NOT NULL,
    summary TEXT NOT NULL,
    performed_at DATETIME(6) NOT NULL,
    technician_name VARCHAR(80) NULL,
    service_company VARCHAR(120) NULL,
    next_due_at DATE NULL,
    source_updated_at DATETIME(6) NOT NULL,
    synced_at DATETIME(6) NOT NULL,
    deleted_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_maintenance_office_id (office_id),
    KEY ix_maintenance_equipment_date (equipment_id, performed_at),
    KEY ix_maintenance_component_date (component_id, performed_at),
    CONSTRAINT fk_maintenance_equipment FOREIGN KEY (equipment_id) REFERENCES EQUIPMENT (id),
    CONSTRAINT fk_maintenance_component FOREIGN KEY (component_id) REFERENCES EQUIPMENT_COMPONENT (id),
    CONSTRAINT ck_maintenance_target CHECK (
        (target_type = 'EQUIPMENT' AND component_id IS NULL)
        OR (target_type = 'COMPONENT' AND component_id IS NOT NULL)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ALERT_RULE (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    site_id VARCHAR(32) NOT NULL,
    equipment_id BIGINT UNSIGNED NULL,
    metric_key VARCHAR(50) NOT NULL,
    rule_type VARCHAR(30) NOT NULL,
    min_value DECIMAL(18,6) NULL,
    max_value DECIMAL(18,6) NULL,
    no_data_minutes INT UNSIGNED NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'WARNING',
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY ix_alert_rule_site_enabled (site_id, is_enabled),
    KEY ix_alert_rule_equipment (equipment_id),
    CONSTRAINT fk_alert_rule_equipment FOREIGN KEY (equipment_id) REFERENCES EQUIPMENT (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ALERT_EVENT (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    rule_id BIGINT UNSIGNED NOT NULL,
    site_id VARCHAR(32) NOT NULL,
    equipment_id BIGINT UNSIGNED NULL,
    event_type VARCHAR(30) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    measured_value DECIMAL(18,6) NULL,
    message VARCHAR(500) NOT NULL,
    recipient_snapshot JSON NOT NULL,
    delivery_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    delivery_error TEXT NULL,
    occurred_at DATETIME(6) NOT NULL,
    acknowledged_by BIGINT UNSIGNED NULL,
    acknowledged_at DATETIME(6) NULL,
    recovered_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY ix_alert_event_site_occurred (site_id, occurred_at),
    KEY ix_alert_event_rule_occurred (rule_id, occurred_at),
    KEY ix_alert_event_open (recovered_at, acknowledged_at),
    KEY ix_alert_event_equipment (equipment_id),
    KEY ix_alert_event_ack_user (acknowledged_by),
    CONSTRAINT fk_alert_event_rule FOREIGN KEY (rule_id) REFERENCES ALERT_RULE (id),
    CONSTRAINT fk_alert_event_equipment FOREIGN KEY (equipment_id) REFERENCES EQUIPMENT (id),
    CONSTRAINT fk_alert_event_ack_user FOREIGN KEY (acknowledged_by) REFERENCES APP_USER (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
