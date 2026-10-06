package com.pentaworks.monitoring.auth;

import com.pentaworks.monitoring.admin.AuditService;
import com.pentaworks.monitoring.auth.CurrentUserService.CurrentUser;
import com.pentaworks.monitoring.auth.InvitationController.InvitationInfo;
import com.pentaworks.monitoring.common.BadRequestException;
import com.pentaworks.monitoring.common.ConflictException;
import com.pentaworks.monitoring.common.NotFoundException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InvitationService {
    private final JdbcTemplate jdbcTemplate;
    private final SecureTokens secureTokens;
    private final PasswordEncoder passwordEncoder;
    private final AuditService audit;

    public InvitationService(JdbcTemplate jdbcTemplate, SecureTokens secureTokens,
                             PasswordEncoder passwordEncoder, AuditService audit) {
        this.jdbcTemplate = jdbcTemplate;
        this.secureTokens = secureTokens;
        this.passwordEncoder = passwordEncoder;
        this.audit = audit;
    }

    public InvitationInfo info(String token) {
        Invitation invitation = find(token, false);
        return new InvitationInfo(invitation.email(), invitation.name(), invitation.role(), invitation.expiresAt());
    }

    @Transactional
    public void accept(String token, String password) {
        validatePassword(password);
        Invitation invitation = find(token, true);
        Integer existing = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM app_user WHERE email=?", Integer.class,
            invitation.email());
        if (existing != null && existing > 0) throw new ConflictException("이미 가입된 이메일입니다.");
        jdbcTemplate.update("""
            INSERT INTO app_user
                (company_id,email,username,password_hash,name,phone,role,status,failed_login_count,
                 password_changed_at,created_at,updated_at)
            VALUES (?,?,?,?,?,?,?, 'ACTIVE',0,CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6))
            """, invitation.companyId(), invitation.email(), invitation.email(), passwordEncoder.encode(password),
            invitation.name(), invitation.phone(), invitation.role());
        Long userId = jdbcTemplate.queryForObject("SELECT id FROM app_user WHERE email=?", Long.class, invitation.email());
        if (userId == null) throw new IllegalStateException("가입 계정을 생성하지 못했습니다.");
        List<String> sites = jdbcTemplate.query("""
            SELECT site_id FROM account_invitation_site WHERE invitation_id=?
            """, (rs, row) -> rs.getString(1), invitation.id());
        if ("USER".equals(invitation.role())) {
            for (String siteId : sites) {
                jdbcTemplate.update("INSERT INTO user_site (user_id,site_id) VALUES (?,?)", userId, siteId);
            }
        }
        jdbcTemplate.update("UPDATE account_invitation SET accepted_at=CURRENT_TIMESTAMP(6) WHERE id=?", invitation.id());
        if ("SUPER_ADMIN".equals(invitation.role())) {
            jdbcTemplate.update("""
                UPDATE company SET status='ACTIVE',updated_at=CURRENT_TIMESTAMP(6)
                 WHERE id=? AND status='PENDING'
                """, invitation.companyId());
        }
        CurrentUser created = new CurrentUser(userId, invitation.companyId(), invitation.email(), invitation.name(),
            invitation.role(), "ACTIVE");
        audit.record(created, "INVITATION_ACCEPTED", "APP_USER", Long.toString(userId),
            Map.of("email", invitation.email(), "role", invitation.role(), "siteIds", sites));
    }

    private Invitation find(String token, boolean forUpdate) {
        if (token == null || token.isBlank()) throw new NotFoundException("유효한 초대를 찾을 수 없습니다.");
        String suffix = forUpdate ? " FOR UPDATE" : "";
        Invitation result = jdbcTemplate.query("""
            SELECT i.id,i.company_id,i.email,i.name,i.phone,i.role,i.expires_at
              FROM account_invitation i JOIN company c ON c.id=i.company_id
             WHERE i.token_hash=? AND i.accepted_at IS NULL AND i.revoked_at IS NULL
               AND i.role IN ('SUPER_ADMIN','ADMIN','USER') AND c.status<>'SUSPENDED'
               AND (i.role<>'SUPER_ADMIN' OR c.status<>'PENDING'
                    OR c.business_registration_verified_at IS NOT NULL)
               AND i.expires_at>CURRENT_TIMESTAMP(6)
            """ + suffix, rs -> rs.next() ? new Invitation(rs.getString("id"), rs.getLong("company_id"),
                rs.getString("email"), rs.getString("name"), rs.getString("phone"), rs.getString("role"),
                rs.getTimestamp("expires_at").toInstant()) : null, secureTokens.hash(token));
        if (result == null) throw new NotFoundException("초대가 만료되었거나 사용할 수 없습니다.");
        return result;
    }

    static void validatePassword(String password) {
        if (password.length() < 12 || !password.matches(".*[A-Za-z].*")
            || !password.matches(".*\\d.*") || !password.matches(".*[^A-Za-z0-9].*")) {
            throw new BadRequestException("비밀번호는 12자 이상이며 영문, 숫자, 특수문자를 포함해야 합니다.");
        }
    }

    private record Invitation(String id, long companyId, String email, String name, String phone, String role, Instant expiresAt) {}
}
