ALTER TABLE company
    ADD COLUMN business_registration_number VARCHAR(20) NULL AFTER name,
    ADD COLUMN business_registration_url VARCHAR(500) NULL AFTER business_registration_number,
    ADD COLUMN business_registration_storage_key VARCHAR(255) NULL AFTER business_registration_url,
    ADD COLUMN business_registration_original_name VARCHAR(255) NULL AFTER business_registration_storage_key,
    ADD COLUMN business_registration_content_type VARCHAR(100) NULL AFTER business_registration_original_name,
    ADD COLUMN business_registration_uploaded_at DATETIME(6) NULL AFTER business_registration_content_type,
    ADD COLUMN business_registration_verified_at DATETIME(6) NULL AFTER business_registration_uploaded_at,
    ADD COLUMN business_registration_verified_by BIGINT UNSIGNED NULL AFTER business_registration_verified_at,
    ADD UNIQUE KEY uq_company_business_registration_number (business_registration_number),
    ADD CONSTRAINT fk_company_registration_verifier FOREIGN KEY (business_registration_verified_by)
        REFERENCES app_user (id) ON DELETE SET NULL;

UPDATE app_user
   SET role='PLATFORM_ADMIN',updated_at=CURRENT_TIMESTAMP(6)
 WHERE email='ihcho@pentaworks.net' AND role='SUPER_ADMIN';
