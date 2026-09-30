package com.pentaworks.monitoring.auth;

import com.pentaworks.monitoring.auth.PasswordResetController.ResetInfo;
import com.pentaworks.monitoring.common.NotFoundException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PasswordResetService {
    private final JdbcTemplate jdbcTemplate;
    private final SecureTokens tokens;
    private final PasswordEncoder passwordEncoder;
    private final SessionRegistry sessions;

    public PasswordResetService(JdbcTemplate jdbcTemplate, SecureTokens tokens, PasswordEncoder passwordEncoder, SessionRegistry sessions) {
        this.jdbcTemplate = jdbcTemplate;
        this.tokens = tokens;
        this.passwordEncoder = passwordEncoder;
        this.sessions = sessions;
    }

    public ResetInfo info(String token) {
        ResetRow row = find(token, false);
        return new ResetInfo(row.email(), row.name());
    }

    @Transactional
    public void reset(String token, String password) {
        InvitationService.validatePassword(password);
        ResetRow row = find(token, true);
        jdbcTemplate.update("""
            UPDATE app_user SET password_hash=?,failed_login_count=0,locked_until=NULL,
                   password_changed_at=CURRENT_TIMESTAMP(6),updated_at=CURRENT_TIMESTAMP(6)
             WHERE id=?
            """, passwordEncoder.encode(password), row.userId());
        jdbcTemplate.update("UPDATE user_session SET revoked_at=CURRENT_TIMESTAMP(6) WHERE user_id=? AND revoked_at IS NULL", row.userId());
        jdbcTemplate.update("UPDATE password_reset_token SET used_at=CURRENT_TIMESTAMP(6) WHERE id=?", row.id());
        jdbcTemplate.update("UPDATE password_reset_token SET revoked_at=CURRENT_TIMESTAMP(6) WHERE user_id=? AND id<>? AND used_at IS NULL AND revoked_at IS NULL", row.userId(), row.id());
        org.springframework.transaction.support.TransactionSynchronizationManager.registerSynchronization(
            new org.springframework.transaction.support.TransactionSynchronization() {
                @Override public void afterCommit() { sessions.invalidateUser(row.userId()); }
            });
        jdbcTemplate.update("""
            INSERT INTO audit_log
                (company_id,actor_user_id,actor_name,action,target_type,target_id,created_at)
            VALUES (?,?,?,'PASSWORD_RESET_COMPLETED','APP_USER',?,CURRENT_TIMESTAMP(6))
            """, row.companyId(), row.userId(), row.name(), Long.toString(row.userId()));
    }

    private ResetRow find(String token, boolean forUpdate) {
        String suffix = forUpdate ? " FOR UPDATE" : "";
        ResetRow row = jdbcTemplate.query("""
            SELECT p.id,u.id AS user_id,u.company_id,u.email,u.name
              FROM password_reset_token p JOIN app_user u ON u.id=p.user_id
              JOIN company c ON c.id=u.company_id
             WHERE p.token_hash=? AND p.used_at IS NULL AND p.revoked_at IS NULL
               AND p.expires_at>CURRENT_TIMESTAMP(6) AND u.status='ACTIVE' AND c.status='ACTIVE'
            """ + suffix, rs -> rs.next() ? new ResetRow(rs.getString("id"), rs.getLong("user_id"),
                rs.getLong("company_id"), rs.getString("email"), rs.getString("name")) : null, tokens.hash(token));
        if (row == null) throw new NotFoundException("비밀번호 재설정 링크가 만료되었거나 사용할 수 없습니다.");
        return row;
    }

    private record ResetRow(String id, long userId, long companyId, String email, String name) {}
}
