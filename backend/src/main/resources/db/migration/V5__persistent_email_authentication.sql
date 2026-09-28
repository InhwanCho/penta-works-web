-- Production authentication foundation.
-- Legacy username accounts are retained, but all new authentication uses email.

ALTER TABLE app_user
    ADD COLUMN IF NOT EXISTS email VARCHAR(254) NULL AFTER company_id,
    ADD COLUMN IF NOT EXISTS last_login_at DATETIME(6) NULL AFTER locked_until;

UPDATE app_user
SET email = LOWER(TRIM(username))
WHERE email IS NULL
  AND username LIKE '%@%';

UPDATE app_user SET role = UPPER(role);

CREATE UNIQUE INDEX IF NOT EXISTS uq_app_user_email ON app_user (email);

INSERT INTO company (code, name, status)
VALUES ('PENTAWORKS', '펜타웍스', 'ACTIVE')
ON DUPLICATE KEY UPDATE name = VALUES(name), status = 'ACTIVE';

INSERT INTO app_user (
    company_id,
    email,
    username,
    password_hash,
    name,
    role,
    status,
    failed_login_count,
    password_changed_at,
    created_at,
    updated_at
)
SELECT
    company.id,
    'whdlsghks2@gmail.com',
    'whdlsghks2@gmail.com',
    '$2a$12$8Ce.Vfq0NpWDx0XbJLjCWevyTFdleSEJNmaRhLOw1yxT8ZtgHMmsu',
    '최고관리자',
    'SUPER_ADMIN',
    'ACTIVE',
    0,
    CURRENT_TIMESTAMP(6),
    CURRENT_TIMESTAMP(6),
    CURRENT_TIMESTAMP(6)
FROM company
WHERE company.code = 'PENTAWORKS'
ON DUPLICATE KEY UPDATE
    email = VALUES(email),
    username = VALUES(username),
    password_hash = VALUES(password_hash),
    name = VALUES(name),
    role = 'SUPER_ADMIN',
    status = 'ACTIVE',
    failed_login_count = 0,
    locked_until = NULL,
    password_changed_at = CURRENT_TIMESTAMP(6),
    updated_at = CURRENT_TIMESTAMP(6);

-- Dashboard hot-path indexes. They stay on the web DB only.
CREATE INDEX IF NOT EXISTS ix_mrtb_date_site ON mrtb (date, siteid);
CREATE INDEX IF NOT EXISTS ix_mrtb_site_index ON mrtb (siteid, `index`);
