CREATE TABLE workspace_record (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 company_id BIGINT NOT NULL,
 author_id BIGINT NOT NULL,
 site_id VARCHAR(32) NULL,
 kind VARCHAR(20) NOT NULL,
 service_type VARCHAR(20) NULL,
 title VARCHAR(200) NOT NULL,
 body LONGTEXT NOT NULL,
 work_date DATE NOT NULL,
 status VARCHAR(20) NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
 deleted_at DATETIME(6) NULL,
 KEY idx_workspace_record_company(company_id,work_date,id)
);
CREATE TABLE workspace_schedule (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 company_id BIGINT NOT NULL,
 author_id BIGINT NOT NULL,
 site_id VARCHAR(32) NULL,
 title VARCHAR(200) NOT NULL,
 body TEXT NOT NULL,
 start_at DATETIME NOT NULL,
 end_at DATETIME NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 deleted_at DATETIME(6) NULL,
 KEY idx_workspace_schedule_company(company_id,start_at)
);
