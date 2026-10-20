CREATE TABLE workspace_firebase_document (
 collection_name VARCHAR(32) NOT NULL,
 source_id VARCHAR(128) NOT NULL,
 payload JSON NOT NULL,
 fetched_at DATETIME(6) NOT NULL,
 PRIMARY KEY(collection_name,source_id)
);
CREATE TABLE workspace_office_snapshot (
 site_id VARCHAR(32) NOT NULL PRIMARY KEY,
 response_json JSON NOT NULL,
 fetched_at DATETIME(6) NOT NULL
);
CREATE TABLE workspace_office_photo (
 site_id VARCHAR(32) NOT NULL,
 maintenance_id BIGINT NOT NULL,
 photo_id BIGINT NOT NULL,
 mime_type VARCHAR(50) NOT NULL,
 image_data LONGBLOB NOT NULL,
 PRIMARY KEY(site_id,maintenance_id,photo_id)
);
