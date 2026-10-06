-- Rebuild retained snapshots with the current exclusions before reusing history.
-- Preaggregate hours to avoid repeatedly scanning raw readings for every metric/window.
CREATE TEMPORARY TABLE metric_reading_hours AS
SELECT m.siteid AS site_id,CAST(DATE_FORMAT(m.date,'%Y-%m-%d %H:00:00') AS DATETIME) AS measured_hour,
       SUM(m.recosi_value) AS recosi_sum,
       COUNT(m.recosi_value) AS recosi_count,
       SUM(m.recosi_unmeasured) AS recosi_excluded,
       MAX(CASE WHEN m.recosi_value IS NOT NULL THEN m.date END) AS recosi_last,
       SUM(m.coldtp_value) AS coldtp_sum,
       COUNT(m.coldtp_value) AS coldtp_count,
       SUM(m.coldtp_unmeasured) AS coldtp_excluded,
       MAX(CASE WHEN m.coldtp_value IS NOT NULL THEN m.date END) AS coldtp_last,
       SUM(m.recoru_value) AS recoru_sum,
       COUNT(m.recoru_value) AS recoru_count,
       SUM(m.recoru_unmeasured) AS recoru_excluded,
       MAX(CASE WHEN m.recoru_value IS NOT NULL THEN m.date END) AS recoru_last,
       SUM(m.hepres_value) AS hepres_sum,
       COUNT(m.hepres_value) AS hepres_count,
       SUM(m.hepres_unmeasured) AS hepres_excluded,
       MAX(CASE WHEN m.hepres_value IS NOT NULL THEN m.date END) AS hepres_last,
       SUM(m.heleve_value) AS heleve_sum,
       COUNT(m.heleve_value) AS heleve_count,
       SUM(m.heleve_unmeasured) AS heleve_excluded,
       MAX(CASE WHEN m.heleve_value IS NOT NULL THEN m.date END) AS heleve_last,
       SUM(m.actemp_value) AS actemp_sum,
       COUNT(m.actemp_value) AS actemp_count,
       SUM(m.actemp_unmeasured) AS actemp_excluded,
       MAX(CASE WHEN m.actemp_value IS NOT NULL THEN m.date END) AS actemp_last,
       SUM(m.achumi_value) AS achumi_sum,
       COUNT(m.achumi_value) AS achumi_count,
       SUM(m.achumi_unmeasured) AS achumi_excluded,
       MAX(CASE WHEN m.achumi_value IS NOT NULL THEN m.date END) AS achumi_last,
       SUM(m.gctemp_value) AS gctemp_sum,
       COUNT(m.gctemp_value) AS gctemp_count,
       SUM(m.gctemp_unmeasured) AS gctemp_excluded,
       MAX(CASE WHEN m.gctemp_value IS NOT NULL THEN m.date END) AS gctemp_last,
       SUM(m.gcflow_value) AS gcflow_sum,
       COUNT(m.gcflow_value) AS gcflow_count,
       SUM(m.gcflow_unmeasured) AS gcflow_excluded,
       MAX(CASE WHEN m.gcflow_value IS NOT NULL THEN m.date END) AS gcflow_last,
       SUM(m.cctemp_value) AS cctemp_sum,
       COUNT(m.cctemp_value) AS cctemp_count,
       SUM(m.cctemp_unmeasured) AS cctemp_excluded,
       MAX(CASE WHEN m.cctemp_value IS NOT NULL THEN m.date END) AS cctemp_last,
       SUM(m.ccflow_value) AS ccflow_sum,
       COUNT(m.ccflow_value) AS ccflow_count,
       SUM(m.ccflow_unmeasured) AS ccflow_excluded,
       MAX(CASE WHEN m.ccflow_value IS NOT NULL THEN m.date END) AS ccflow_last
FROM mrtb m
WHERE m.date >= (SELECT DATE_SUB(MIN(captured_at),INTERVAL 24 HOUR) FROM site_metric_average_hourly)
  AND m.date < (SELECT MAX(captured_at) FROM site_metric_average_hourly)
GROUP BY m.siteid,measured_hour;
ALTER TABLE metric_reading_hours ADD INDEX ix_reading_hour (site_id,measured_hour);

CREATE TEMPORARY TABLE refreshed_metric_averages AS
SELECT h.site_id,h.metric_key,h.captured_at,
       SUM(CASE h.metric_key WHEN 'recosi' THEN m.recosi_sum WHEN 'coldtp' THEN m.coldtp_sum WHEN 'recoru' THEN m.recoru_sum WHEN 'hepres' THEN m.hepres_sum WHEN 'heleve' THEN m.heleve_sum WHEN 'actemp' THEN m.actemp_sum WHEN 'achumi' THEN m.achumi_sum WHEN 'gctemp' THEN m.gctemp_sum WHEN 'gcflow' THEN m.gcflow_sum WHEN 'cctemp' THEN m.cctemp_sum WHEN 'ccflow' THEN m.ccflow_sum END) / NULLIF(SUM(CASE h.metric_key WHEN 'recosi' THEN m.recosi_count WHEN 'coldtp' THEN m.coldtp_count WHEN 'recoru' THEN m.recoru_count WHEN 'hepres' THEN m.hepres_count WHEN 'heleve' THEN m.heleve_count WHEN 'actemp' THEN m.actemp_count WHEN 'achumi' THEN m.achumi_count WHEN 'gctemp' THEN m.gctemp_count WHEN 'gcflow' THEN m.gcflow_count WHEN 'cctemp' THEN m.cctemp_count WHEN 'ccflow' THEN m.ccflow_count END),0) AS average_value,
       COALESCE(SUM(CASE h.metric_key WHEN 'recosi' THEN m.recosi_count WHEN 'coldtp' THEN m.coldtp_count WHEN 'recoru' THEN m.recoru_count WHEN 'hepres' THEN m.hepres_count WHEN 'heleve' THEN m.heleve_count WHEN 'actemp' THEN m.actemp_count WHEN 'achumi' THEN m.achumi_count WHEN 'gctemp' THEN m.gctemp_count WHEN 'gcflow' THEN m.gcflow_count WHEN 'cctemp' THEN m.cctemp_count WHEN 'ccflow' THEN m.ccflow_count END),0) AS sample_count,
       COALESCE(SUM(CASE h.metric_key WHEN 'recosi' THEN m.recosi_excluded WHEN 'coldtp' THEN m.coldtp_excluded WHEN 'recoru' THEN m.recoru_excluded WHEN 'hepres' THEN m.hepres_excluded WHEN 'heleve' THEN m.heleve_excluded WHEN 'actemp' THEN m.actemp_excluded WHEN 'achumi' THEN m.achumi_excluded WHEN 'gctemp' THEN m.gctemp_excluded WHEN 'gcflow' THEN m.gcflow_excluded WHEN 'cctemp' THEN m.cctemp_excluded WHEN 'ccflow' THEN m.ccflow_excluded END),0) AS zero_count,
       MAX(CASE h.metric_key WHEN 'recosi' THEN m.recosi_last WHEN 'coldtp' THEN m.coldtp_last WHEN 'recoru' THEN m.recoru_last WHEN 'hepres' THEN m.hepres_last WHEN 'heleve' THEN m.heleve_last WHEN 'actemp' THEN m.actemp_last WHEN 'achumi' THEN m.achumi_last WHEN 'gctemp' THEN m.gctemp_last WHEN 'gcflow' THEN m.gcflow_last WHEN 'cctemp' THEN m.cctemp_last WHEN 'ccflow' THEN m.ccflow_last END) AS last_sample_at
FROM site_metric_average_hourly h
LEFT JOIN metric_reading_hours m ON m.site_id=h.site_id
  AND m.measured_hour>=DATE_SUB(h.captured_at,INTERVAL 24 HOUR) AND m.measured_hour<h.captured_at
GROUP BY h.site_id,h.metric_key,h.captured_at;

UPDATE site_metric_average_hourly h JOIN refreshed_metric_averages r
    ON h.site_id=r.site_id AND h.metric_key=r.metric_key AND h.captured_at=r.captured_at
SET h.average_value=r.average_value,h.sample_count=r.sample_count,
    h.zero_count=r.zero_count,h.last_sample_at=r.last_sample_at;
DROP TEMPORARY TABLE refreshed_metric_averages;
DROP TEMPORARY TABLE metric_reading_hours;
