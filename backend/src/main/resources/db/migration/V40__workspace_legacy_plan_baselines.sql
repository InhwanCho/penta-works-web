ALTER TABLE workspace_hospital_plan
 ADD COLUMN last_pm_date DATE NULL,
 ADD COLUMN last_acr_full_date DATE NULL,
 ADD COLUMN last_acr_doc_date DATE NULL;
ALTER TABLE workspace_schedule ADD COLUMN source_id VARCHAR(128) NULL, ADD UNIQUE KEY uq_workspace_schedule_source(company_id,source_id);
ALTER TABLE workspace_preparation ADD COLUMN source_id VARCHAR(128) NULL, ADD UNIQUE KEY uq_workspace_preparation_source(company_id,source_id);
