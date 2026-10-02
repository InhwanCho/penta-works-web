ALTER TABLE site_alert_policy ADD COLUMN cold_chiller_active BOOLEAN NOT NULL DEFAULT FALSE;

-- Only replace untouched legacy ordering; company-customized ordering is preserved.
CREATE TEMPORARY TABLE legacy_column_companies AS
SELECT company_id FROM company_metric_config GROUP BY company_id
HAVING GROUP_CONCAT(metric_key ORDER BY sort_order SEPARATOR ',') =
 'recosi,coldtp,recoru,hepres,heleve,actemp,achumi,gctemp,gcflow,cctemp,ccflow';
UPDATE company_metric_config c JOIN legacy_column_companies l ON l.company_id=c.company_id
SET c.sort_order=CASE c.metric_key
 WHEN 'hepres' THEN 0 WHEN 'heleve' THEN 1 WHEN 'gctemp' THEN 2
 WHEN 'cctemp' THEN 3 WHEN 'ccflow' THEN 4 WHEN 'actemp' THEN 5 WHEN 'achumi' THEN 6
 WHEN 'recosi' THEN 10 WHEN 'recoru' THEN 11 WHEN 'coldtp' THEN 12 ELSE 13 END,
 c.is_visible=IF(c.metric_key='gcflow',FALSE,c.is_visible);
DROP TEMPORARY TABLE legacy_column_companies;
-- Preserve explicitly customized display names and units.
UPDATE company_metric_config SET display_name='항온항습기 온도' WHERE metric_key='actemp' AND display_name='AC Temp';
UPDATE company_metric_config SET display_name='항온항습기 습도' WHERE metric_key='achumi' AND display_name='AC Humidity';
UPDATE company_metric_config SET display_name='콜드칠러 IN 온도' WHERE metric_key='cctemp' AND display_name='콜드칠러 온도';
UPDATE company_metric_config SET display_name='콜드칠러 OUT 온도',unit='°C' WHERE metric_key='ccflow' AND display_name='콜드칠러 유량' AND unit IS NULL;
