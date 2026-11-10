CREATE TABLE workspace_inspection_memo (
 company_id BIGINT NOT NULL,
 site_id VARCHAR(64) NOT NULL,
 inspection_type VARCHAR(20) NOT NULL,
 memo VARCHAR(2000) NOT NULL,
 PRIMARY KEY (company_id, site_id, inspection_type)
);
