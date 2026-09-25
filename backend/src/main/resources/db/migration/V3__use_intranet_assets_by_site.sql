-- 장비·부품·정비이력은 인트라넷을 원본으로 사용하고 MREyes에서는 사이트 ID로 읽는다.
-- MREyes에는 별도 복제 테이블을 유지하지 않으며 감시·알림도 사이트 기준으로 동작한다.

ALTER TABLE ALERT_EVENT
    DROP FOREIGN KEY IF EXISTS fk_alert_event_equipment,
    DROP INDEX IF EXISTS ix_alert_event_equipment,
    DROP COLUMN IF EXISTS equipment_id;

ALTER TABLE ALERT_RULE
    DROP FOREIGN KEY IF EXISTS fk_alert_rule_equipment,
    DROP INDEX IF EXISTS ix_alert_rule_equipment,
    DROP COLUMN IF EXISTS equipment_id;

DROP TABLE IF EXISTS MAINTENANCE_HISTORY;
DROP TABLE IF EXISTS EQUIPMENT_COMPONENT;
DROP TABLE IF EXISTS EQUIPMENT;

-- 기존 3자 사이트 코드 제약을 신규/외부 사이트 ID와 동일한 길이로 확장한다.
ALTER TABLE site MODIFY COLUMN site VARCHAR(32) NOT NULL;
ALTER TABLE ctrl MODIFY COLUMN site VARCHAR(32) NOT NULL;
ALTER TABLE down MODIFY COLUMN site VARCHAR(32) NOT NULL;
ALTER TABLE mrtb MODIFY COLUMN siteid VARCHAR(32) NULL;
