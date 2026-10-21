ALTER TABLE workspace_record ADD COLUMN revision BIGINT NOT NULL DEFAULT 1;
ALTER TABLE workspace_schedule ADD COLUMN revision BIGINT NOT NULL DEFAULT 1;
CREATE TABLE workspace_change_history (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 company_id BIGINT NOT NULL,
 resource_type VARCHAR(16) NOT NULL,
 resource_id BIGINT NOT NULL,
 revision BIGINT NOT NULL,
 action VARCHAR(16) NOT NULL,
 actor_id BIGINT NOT NULL,
 snapshot_json LONGTEXT NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 INDEX ix_workspace_history (company_id,resource_type,resource_id,id),
 CONSTRAINT ck_workspace_history_json CHECK (JSON_VALID(snapshot_json))
);
CREATE INDEX ix_workspace_record_company_date ON workspace_record(company_id,deleted_at,work_date,id);
CREATE INDEX ix_workspace_schedule_company_date ON workspace_schedule(company_id,deleted_at,start_at,end_at);
