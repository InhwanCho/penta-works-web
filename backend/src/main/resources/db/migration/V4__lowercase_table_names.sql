-- Linux/MariaDB의 대소문자 구분 환경에서 모든 MREyes 테이블명을 소문자로 통일한다.
DROP TABLE IF EXISTS down;

RENAME TABLE
    COMPANY TO company,
    COMPANY_SITE TO company_site,
    SITE_PROFILE TO site_profile,
    COMPANY_METRIC_CONFIG TO company_metric_config,
    APP_USER TO app_user,
    USER_SITE TO user_site,
    SITE_ALERT_RECIPIENT TO site_alert_recipient,
    USER_SESSION TO user_session,
    AUDIT_LOG TO audit_log,
    OFFICE_INTEGRATION TO office_integration,
    OFFICE_ASSET_SYNC_STATE TO office_asset_sync_state,
    OFFICE_SYNC_RUN TO office_sync_run,
    ALERT_RULE TO alert_rule,
    ALERT_EVENT TO alert_event;
