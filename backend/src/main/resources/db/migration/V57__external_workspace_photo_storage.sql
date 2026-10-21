ALTER TABLE workspace_photo
 MODIFY image_data LONGBLOB NULL,
 ADD COLUMN storage_key VARCHAR(200) NULL,
 ADD COLUMN thumbnail_key VARCHAR(200) NULL,
 ADD COLUMN content_sha256 CHAR(64) NULL,
 ADD COLUMN thumbnail_sha256 CHAR(64) NULL,
 ADD COLUMN thumbnail_bytes BIGINT NULL;
