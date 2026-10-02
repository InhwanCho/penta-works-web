-- These application-owned references were checked for orphans and matching
-- utf8mb4_unicode_ci VARCHAR(32) definitions before enabling enforcement.
-- Legacy ingestion tables (mrtb/alert_log) remain outside this constraint set.
ALTER TABLE company_site ADD CONSTRAINT fk_company_site_site
    FOREIGN KEY (site_id) REFERENCES site (site) ON DELETE RESTRICT;
ALTER TABLE site_profile ADD CONSTRAINT fk_site_profile_site
    FOREIGN KEY (site_id) REFERENCES site (site) ON DELETE RESTRICT;
ALTER TABLE user_site ADD CONSTRAINT fk_user_site_site
    FOREIGN KEY (site_id) REFERENCES site (site) ON DELETE RESTRICT;
ALTER TABLE account_invitation_site ADD CONSTRAINT fk_invitation_site_site
    FOREIGN KEY (site_id) REFERENCES site (site) ON DELETE RESTRICT;
ALTER TABLE site_alert_recipient ADD CONSTRAINT fk_alert_recipient_site
    FOREIGN KEY (site_id) REFERENCES site (site) ON DELETE RESTRICT;
ALTER TABLE site_alert_policy ADD CONSTRAINT fk_site_alert_policy_site
    FOREIGN KEY (site_id) REFERENCES site (site) ON DELETE RESTRICT;
ALTER TABLE site_alert_holiday ADD CONSTRAINT fk_site_alert_holiday_site
    FOREIGN KEY (site_id) REFERENCES site (site) ON DELETE RESTRICT;
ALTER TABLE site_metric_average_policy ADD CONSTRAINT fk_site_average_policy_site
    FOREIGN KEY (site_id) REFERENCES site (site) ON DELETE RESTRICT;
ALTER TABLE site_metric_average_hourly ADD CONSTRAINT fk_site_average_hourly_site
    FOREIGN KEY (site_id) REFERENCES site (site) ON DELETE RESTRICT;
ALTER TABLE office_asset_sync_state ADD CONSTRAINT fk_asset_sync_site
    FOREIGN KEY (site_id) REFERENCES site (site) ON DELETE RESTRICT;
ALTER TABLE alert_rule ADD CONSTRAINT fk_alert_rule_site
    FOREIGN KEY (site_id) REFERENCES site (site) ON DELETE RESTRICT;
ALTER TABLE alert_event ADD CONSTRAINT fk_alert_event_site
    FOREIGN KEY (site_id) REFERENCES site (site) ON DELETE RESTRICT;
-- The legacy alert-settings code was limited to ten characters although new
-- site IDs can contain up to 32. Widen before attaching its reference.
ALTER TABLE alert_settings MODIFY COLUMN siteid VARCHAR(32) NOT NULL;
ALTER TABLE alert_settings ADD CONSTRAINT fk_alert_settings_site
    FOREIGN KEY (siteid) REFERENCES site (site) ON DELETE RESTRICT;

CREATE INDEX ix_reset_token_expiry ON password_reset_token (expires_at);
CREATE INDEX ix_invitation_expiry ON account_invitation (expires_at);
