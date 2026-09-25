-- Move legacy MREyes login accounts into APP_USER, then retire `users`.
-- Password hashes and roles are preserved as-is so existing credentials continue to work.

INSERT INTO COMPANY (code, name, status)
VALUES ('PENTAWORKS', '펜타웍스', 'ACTIVE')
ON DUPLICATE KEY UPDATE name = VALUES(name), status = 'ACTIVE';

INSERT INTO APP_USER (
    company_id,
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
    legacy.username,
    legacy.password,
    legacy.username,
    LOWER(COALESCE(legacy.role, 'user')),
    'ACTIVE',
    0,
    COALESCE(legacy.created_at, CURRENT_TIMESTAMP(6)),
    COALESCE(legacy.created_at, CURRENT_TIMESTAMP(6)),
    CURRENT_TIMESTAMP(6)
FROM users legacy
JOIN COMPANY company ON company.code = 'PENTAWORKS'
ON DUPLICATE KEY UPDATE
    password_hash = VALUES(password_hash),
    role = VALUES(role),
    status = 'ACTIVE',
    updated_at = CURRENT_TIMESTAMP(6);

DROP TABLE users;
