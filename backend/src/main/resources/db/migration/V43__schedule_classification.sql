ALTER TABLE workspace_schedule
 ADD COLUMN target_kind VARCHAR(20) NULL,
 ADD COLUMN personal_kind VARCHAR(24) NULL,
 ADD COLUMN service_type VARCHAR(24) NULL;

-- Restore source classifications from the retained 2026-10-16 Firebase snapshot.
UPDATE workspace_schedule SET target_kind='GENERAL', personal_kind='leave', service_type=NULL
 WHERE source_id IN ('firebase:mv8wg6fpgffre','firebase:mv9olc422eobd','firebase:mv9omtq70m45s');
UPDATE workspace_schedule SET target_kind='HOSPITAL', service_type='ETC'
 WHERE source_id='firebase:munq920jcvu1b';
UPDATE workspace_schedule SET target_kind='HOSPITAL', service_type='PM'
 WHERE source_id='firebase:muw8uny4jkqyl';
