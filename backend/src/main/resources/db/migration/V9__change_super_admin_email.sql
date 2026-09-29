-- Change the original bootstrap super administrator login without resetting its password.
UPDATE app_user
   SET email='ihcho@pentaworks.net',
       username='ihcho@pentaworks.net',
       updated_at=CURRENT_TIMESTAMP(6)
 WHERE email='whdlsghks2@gmail.com'
   AND role='SUPER_ADMIN';

-- Existing access tokens contain the old email claim, so force a clean login.
UPDATE user_session s
JOIN app_user u ON u.id=s.user_id
   SET s.revoked_at=CURRENT_TIMESTAMP(6)
 WHERE u.email='ihcho@pentaworks.net'
   AND u.role='SUPER_ADMIN'
   AND s.revoked_at IS NULL;
