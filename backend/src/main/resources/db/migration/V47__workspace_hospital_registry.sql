-- Hospital identity is independent of monitoring identity. Existing site references
-- remain stable while Firebase/Office migration is still in progress.
CREATE TABLE workspace_hospital (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 company_id BIGINT UNSIGNED NOT NULL,
 site_id VARCHAR(32) NOT NULL,
 name VARCHAR(120) NOT NULL,
 monitoring_site_id VARCHAR(32) NULL,
 notes TEXT NOT NULL,
 revision INT NOT NULL DEFAULT 1,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
 UNIQUE KEY uq_workspace_hospital_site(site_id),
 UNIQUE KEY uq_workspace_hospital_monitor(company_id,monitoring_site_id),
 CONSTRAINT fk_workspace_hospital_company_site FOREIGN KEY(company_id,site_id) REFERENCES company_site(company_id,site_id),
 CONSTRAINT fk_workspace_hospital_monitor_site FOREIGN KEY(company_id,monitoring_site_id) REFERENCES company_site(company_id,site_id)
);
INSERT INTO workspace_hospital(company_id,site_id,name,monitoring_site_id,notes)
SELECT cs.company_id,cs.site_id,COALESCE(NULLIF(s.name,''),cs.site_id),
 CASE WHEN c.code='PENTAWORKS' AND cs.site_id IN ('900001','900002') THEN NULL ELSE cs.site_id END,''
FROM company_site cs JOIN site s ON s.site=cs.site_id JOIN company c ON c.id=cs.company_id;
