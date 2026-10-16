ALTER TABLE workspace_record ADD COLUMN details_json JSON NULL;
CREATE TABLE workspace_photo (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 company_id BIGINT NOT NULL,
 author_id BIGINT NOT NULL,
 record_id BIGINT NULL,
 original_name VARCHAR(255) NOT NULL,
 mime_type VARCHAR(50) NOT NULL,
 image_data LONGBLOB NOT NULL,
 byte_size BIGINT NOT NULL,
 width_px INT NOT NULL,
 height_px INT NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 KEY idx_workspace_photo_record(record_id),
 KEY idx_workspace_photo_staged(company_id,author_id,record_id),
 CONSTRAINT fk_workspace_photo_record FOREIGN KEY(record_id) REFERENCES workspace_record(id)
);
CREATE TABLE workspace_hospital_plan (
 company_id BIGINT NOT NULL,
 site_id VARCHAR(32) NOT NULL,
 pm_interval_months INT NOT NULL DEFAULT 2,
 pm_override DATE NULL,
 acr_full_override DATE NULL,
 acr_doc_override DATE NULL,
 PRIMARY KEY(company_id,site_id)
);
CREATE TABLE workspace_preparation (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 company_id BIGINT NOT NULL,
 author_id BIGINT NOT NULL,
 site_id VARCHAR(32) NULL,
 record_id BIGINT NULL,
 content VARCHAR(1000) NOT NULL,
 done BOOLEAN NOT NULL DEFAULT FALSE,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 KEY idx_workspace_preparation_company(company_id,done)
);
