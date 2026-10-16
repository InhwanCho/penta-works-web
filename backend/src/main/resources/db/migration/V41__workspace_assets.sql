CREATE TABLE workspace_asset (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 company_id BIGINT NOT NULL,
 site_id VARCHAR(32) NOT NULL,
 asset_type VARCHAR(24) NOT NULL,
 name VARCHAR(200) NOT NULL,
 model VARCHAR(200) NOT NULL DEFAULT '',
 version VARCHAR(100) NOT NULL DEFAULT '',
 serial_number VARCHAR(200) NOT NULL DEFAULT '',
 installed_at DATE NULL,
 status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
 notes TEXT NOT NULL,
 revision INT NOT NULL DEFAULT 1,
 updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
 KEY idx_workspace_asset_site(company_id,site_id)
);
CREATE TABLE workspace_asset_history (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 asset_id BIGINT NOT NULL,
 record_id BIGINT NOT NULL,
 snapshot_json JSON NOT NULL,
 change_kind VARCHAR(24) NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 UNIQUE KEY uq_workspace_asset_record(asset_id,record_id),
 CONSTRAINT fk_workspace_asset_history_asset FOREIGN KEY(asset_id) REFERENCES workspace_asset(id),
 CONSTRAINT fk_workspace_asset_history_record FOREIGN KEY(record_id) REFERENCES workspace_record(id)
);
