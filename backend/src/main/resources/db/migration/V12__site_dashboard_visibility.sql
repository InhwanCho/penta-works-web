ALTER TABLE company_site
    ADD COLUMN is_dashboard_visible BOOLEAN NOT NULL DEFAULT TRUE AFTER site_id;
