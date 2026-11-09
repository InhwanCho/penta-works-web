INSERT IGNORE INTO company_notification_policy (company_id, settings_json)
SELECT c.id, JSON_OBJECT(
    'tolerancePercent', 50, 'pressureWarning', 2.3, 'pressureCritical', 2.5, 'gradientCritical', 28,
    'missingWarning', 3, 'missingCritical', 6, 'collectionWarning', 2, 'collectionCritical', 3,
    'coldChillerEnabled', JSON_EXTRACT('true', '$'),
    'hospitals', JSON_OBJECT(
        '001', JSON_OBJECT('enabled', JSON_EXTRACT('false', '$'), 'intervalMinutes', 10),
        '016', JSON_OBJECT('enabled', JSON_EXTRACT('true', '$'), 'intervalMinutes', 60)))
FROM company c
JOIN company_site retired ON retired.company_id = c.id AND retired.site_id = '001'
JOIN site s1 ON s1.site = retired.site_id AND s1.name = '순천향병'
JOIN company_site hourly ON hourly.company_id = c.id AND hourly.site_id = '016'
JOIN site s2 ON s2.site = hourly.site_id AND s2.name = '대구동물'
WHERE c.code = 'PENTAWORKS';

-- Retain history, but retire incidents from old personal rules that no longer send alerts.
UPDATE alert_event e
JOIN alert_rule r ON r.id = e.rule_id
JOIN app_user u ON u.id = r.user_id
LEFT JOIN company_notification_policy p ON p.company_id = u.company_id
SET e.recovered_at = CURRENT_TIMESTAMP(6)
WHERE e.recovered_at IS NULL AND (
    NOT (
        (r.metric_key IN ('hepres', 'gctemp', '__cold_chiller__') AND e.event_type = 'HIGH')
        OR (r.metric_key = 'hepres' AND e.event_type = 'METRIC_MISSING')
        OR (r.metric_key = '__data__' AND e.event_type = 'NO_DATA')
    )
    OR JSON_UNQUOTE(JSON_EXTRACT(p.settings_json, CONCAT('$.hospitals.', JSON_QUOTE(r.site_id), '.enabled'))) = 'false'
    OR (e.event_type = 'NO_DATA' AND NOT EXISTS (SELECT 1 FROM mrtb m WHERE m.siteid = r.site_id))
);
