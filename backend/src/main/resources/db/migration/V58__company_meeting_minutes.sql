-- Intranet weekly meeting structure, scoped to the company in MReyes.
CREATE TABLE workspace_meeting (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 company_id BIGINT UNSIGNED NOT NULL,
 source_id VARCHAR(100) NULL,
 title VARCHAR(200) NOT NULL,
 meeting_at DATETIME(6) NOT NULL,
 content_markdown LONGTEXT NOT NULL,
 author_id BIGINT NULL,
 author_name VARCHAR(200) NOT NULL,
 updated_by_id BIGINT NULL,
 updated_by_name VARCHAR(200) NOT NULL,
 participant_names VARCHAR(1000) NOT NULL DEFAULT '',
 revision BIGINT NOT NULL DEFAULT 1,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 deleted_at DATETIME(6) NULL,
 UNIQUE KEY uq_workspace_meeting_source(company_id,source_id),
 KEY ix_workspace_meeting_date(company_id,deleted_at,meeting_at,id),
 CONSTRAINT fk_workspace_meeting_company FOREIGN KEY(company_id) REFERENCES company(id)
);
