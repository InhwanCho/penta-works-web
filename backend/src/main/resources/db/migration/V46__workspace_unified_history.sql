-- Additive transition: retain snapshots, source identifiers and imported planning baselines.
ALTER TABLE workspace_schedule ADD UNIQUE KEY uq_workspace_schedule_company_id(company_id,id);
ALTER TABLE workspace_record
 ADD COLUMN source_id VARCHAR(128) NULL,
 ADD COLUMN engineer_name VARCHAR(200) NOT NULL DEFAULT '',
 ADD COLUMN counts_as_pm BOOLEAN NOT NULL DEFAULT FALSE,
 ADD COLUMN acr_kind VARCHAR(20) NULL,
 ADD COLUMN schedule_id BIGINT NULL,
 ADD UNIQUE KEY uq_workspace_record_source(company_id,source_id),
 ADD UNIQUE KEY uq_workspace_record_company_id(company_id,id),
 ADD KEY idx_workspace_record_site_date(company_id,site_id,work_date,id),
 ADD CONSTRAINT fk_workspace_record_schedule FOREIGN KEY(company_id,schedule_id) REFERENCES workspace_schedule(company_id,id);
UPDATE workspace_record SET
 engineer_name=COALESCE(JSON_UNQUOTE(JSON_EXTRACT(details_json,'$.engineer')),''),
 counts_as_pm=COALESCE(JSON_EXTRACT(details_json,'$.countsAsPm')=TRUE,FALSE),
 acr_kind=NULLIF(JSON_UNQUOTE(JSON_EXTRACT(details_json,'$.acrKind')),'');
ALTER TABLE workspace_asset
 ADD COLUMN source_id VARCHAR(128) NULL,
 ADD COLUMN metadata_json JSON NULL,
 ADD UNIQUE KEY uq_workspace_asset_source(company_id,source_id);
ALTER TABLE workspace_photo
 ADD COLUMN source_id VARCHAR(128) NULL,
 ADD UNIQUE KEY uq_workspace_photo_source(company_id,source_id),
 ADD CONSTRAINT fk_workspace_photo_company_record FOREIGN KEY(company_id,record_id) REFERENCES workspace_record(company_id,id);
ALTER TABLE workspace_preparation
 ADD CONSTRAINT fk_workspace_preparation_company_record FOREIGN KEY(company_id,record_id) REFERENCES workspace_record(company_id,id);
ALTER TABLE workspace_office_snapshot ADD COLUMN company_id BIGINT NULL;
UPDATE workspace_office_snapshot SET company_id=(SELECT id FROM company WHERE code='PENTAWORKS');
ALTER TABLE workspace_asset ADD UNIQUE KEY uq_workspace_asset_company_id(company_id,id);
ALTER TABLE workspace_asset_history ADD COLUMN company_id BIGINT NULL;
UPDATE workspace_asset_history h JOIN workspace_asset a ON a.id=h.asset_id SET h.company_id=a.company_id;
ALTER TABLE workspace_asset_history
 MODIFY COLUMN company_id BIGINT NOT NULL,
 ADD CONSTRAINT fk_workspace_history_company_asset FOREIGN KEY(company_id,asset_id) REFERENCES workspace_asset(company_id,id),
 ADD CONSTRAINT fk_workspace_history_company_record FOREIGN KEY(company_id,record_id) REFERENCES workspace_record(company_id,id);
