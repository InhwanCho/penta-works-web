CREATE TABLE privacy_request (
 id CHAR(36) NOT NULL PRIMARY KEY,
 company_id BIGINT UNSIGNED NOT NULL,
 user_id BIGINT UNSIGNED NOT NULL,
 kind VARCHAR(30) NOT NULL,
 content TEXT NOT NULL,
 status VARCHAR(20) NOT NULL DEFAULT 'RECEIVED',
 response_text TEXT NULL,
 identity_verified BOOLEAN NOT NULL DEFAULT FALSE,
 handled_by BIGINT UNSIGNED NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
 INDEX ix_privacy_company_status(company_id,status,created_at),
 INDEX ix_privacy_user(user_id,created_at),
 FOREIGN KEY(company_id) REFERENCES company(id),
 FOREIGN KEY(user_id) REFERENCES app_user(id)
);
-- Minimal identifiers only: lets restores repeat approved account anonymization.
CREATE TABLE privacy_deletion_marker (
 id CHAR(36) NOT NULL PRIMARY KEY,
 company_id BIGINT UNSIGNED NOT NULL,
 user_id BIGINT UNSIGNED NOT NULL,
 user_created_at DATETIME(6) NOT NULL,
 deleted_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 UNIQUE KEY uq_privacy_deleted_identity(company_id,user_id,user_created_at)
);
CREATE TABLE calendar_connection_notice (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 company_id BIGINT UNSIGNED NOT NULL,
 user_id BIGINT UNSIGNED NOT NULL,
 notice_version VARCHAR(40) NOT NULL,
 acknowledged_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 INDEX ix_calendar_notice_user(user_id,acknowledged_at)
);
INSERT INTO privacy_deletion_marker(id,company_id,user_id,user_created_at)
 SELECT UUID(),company_id,id,created_at FROM app_user WHERE status='DELETED';
