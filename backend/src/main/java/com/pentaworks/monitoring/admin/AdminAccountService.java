package com.pentaworks.monitoring.admin;

import com.pentaworks.monitoring.admin.AdminAccountController.InvitationCreated;
import com.pentaworks.monitoring.admin.AdminAccountController.AuditSummary;
import com.pentaworks.monitoring.admin.AdminAccountController.InvitationSummary;
import com.pentaworks.monitoring.admin.AdminAccountController.InviteRequest;
import com.pentaworks.monitoring.admin.AdminAccountController.SiteOption;
import com.pentaworks.monitoring.admin.AdminAccountController.UpdateUserRequest;
import com.pentaworks.monitoring.admin.AdminAccountController.UserSummary;
import com.pentaworks.monitoring.admin.AdminAccountController.PasswordResetCreated;
import com.pentaworks.monitoring.auth.CurrentUserService.CurrentUser;
import com.pentaworks.monitoring.auth.SecureTokens;
import com.pentaworks.monitoring.common.BadRequestException;
import com.pentaworks.monitoring.common.ConflictException;
import com.pentaworks.monitoring.common.ForbiddenException;
import com.pentaworks.monitoring.common.NotFoundException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminAccountService {
    private static final Set<String> MANAGED_ROLES = Set.of("ADMIN", "USER");
    private static final Set<String> STATUSES = Set.of("ACTIVE", "SUSPENDED");

    private final JdbcTemplate jdbcTemplate;
    private final SecureTokens secureTokens;
    private final AuditService audit;

    public AdminAccountService(JdbcTemplate jdbcTemplate, SecureTokens secureTokens, AuditService audit) {
        this.jdbcTemplate = jdbcTemplate;
        this.secureTokens = secureTokens;
        this.audit = audit;
    }

    public List<UserSummary> users(CurrentUser actor) {
        requireAdmin(actor);
        return jdbcTemplate.query("""
            SELECT id,email,name,role,status,last_login_at,created_at
              FROM app_user WHERE company_id=? AND email IS NOT NULL
             ORDER BY CASE role WHEN 'SUPER_ADMIN' THEN 0 WHEN 'ADMIN' THEN 1 ELSE 2 END, name, email
            """, (rs, row) -> new UserSummary(rs.getLong("id"), rs.getString("email"), rs.getString("name"),
                rs.getString("role"), rs.getString("status"), instant(rs.getTimestamp("last_login_at")),
                instant(rs.getTimestamp("created_at")), userSites(rs.getLong("id"))), actor.companyId());
    }

    public List<SiteOption> sites(CurrentUser actor) {
        requireAdmin(actor);
        return jdbcTemplate.query("""
            SELECT cs.site_id,s.name FROM company_site cs
            LEFT JOIN site s ON s.site=cs.site_id
            WHERE cs.company_id=? ORDER BY cs.site_id
            """, (rs, row) -> new SiteOption(rs.getString(1), rs.getString(2)), actor.companyId());
    }

    public List<InvitationSummary> invitations(CurrentUser actor) {
        requireAdmin(actor);
        return jdbcTemplate.query("""
            SELECT id,email,name,role,expires_at,created_at
              FROM account_invitation
             WHERE company_id=? AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>CURRENT_TIMESTAMP(6)
             ORDER BY created_at DESC
            """, (rs, row) -> new InvitationSummary(rs.getString("id"), rs.getString("email"),
                rs.getString("name"), rs.getString("role"), rs.getTimestamp("expires_at").toInstant(),
                rs.getTimestamp("created_at").toInstant(), invitationSites(rs.getString("id"))), actor.companyId());
    }

    public List<AuditSummary> auditLogs(CurrentUser actor) {
        requireAdmin(actor);
        return jdbcTemplate.query("""
            SELECT id,actor_name,action,target_type,target_id,created_at
              FROM audit_log WHERE company_id=? ORDER BY created_at DESC LIMIT 200
            """, (rs, row) -> new AuditSummary(rs.getLong("id"), rs.getString("actor_name"),
                rs.getString("action"), rs.getString("target_type"), rs.getString("target_id"),
                rs.getTimestamp("created_at").toInstant()), actor.companyId());
    }

    @Transactional
    public InvitationCreated invite(CurrentUser actor, InviteRequest request) {
        requireAdmin(actor);
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        String role = normalizeRole(request.role());
        if (!actor.isSuperAdmin() && "ADMIN".equals(role)) {
            throw new ForbiddenException("관리자 초대는 최고관리자만 할 수 있습니다.");
        }
        Integer existing = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM app_user WHERE email=?", Integer.class, email);
        if (existing != null && existing > 0) throw new ConflictException("이미 등록된 이메일입니다.");
        List<String> siteIds = validateSites(actor.companyId(), request.siteIds());
        jdbcTemplate.update("""
            UPDATE account_invitation SET revoked_at=CURRENT_TIMESTAMP(6)
             WHERE company_id=? AND email=? AND accepted_at IS NULL AND revoked_at IS NULL
            """, actor.companyId(), email);

        String id = UUID.randomUUID().toString();
        String token = secureTokens.create();
        Instant expiresAt = Instant.now().plus(7, ChronoUnit.DAYS);
        jdbcTemplate.update("""
            INSERT INTO account_invitation
                (id,company_id,email,name,role,token_hash,invited_by,expires_at,created_at)
            VALUES (?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP(6))
            """, id, actor.companyId(), email, request.name().trim(), role, secureTokens.hash(token), actor.id(),
            Timestamp.from(expiresAt));
        for (String siteId : siteIds) {
            jdbcTemplate.update("INSERT INTO account_invitation_site (invitation_id,site_id) VALUES (?,?)", id, siteId);
        }
        audit.record(actor, "ACCOUNT_INVITED", "ACCOUNT_INVITATION", id,
            Map.of("email", email, "role", role, "siteIds", siteIds));
        return new InvitationCreated(id, token, email, expiresAt);
    }

    @Transactional
    public void revokeInvitation(CurrentUser actor, String id) {
        requireAdmin(actor);
        int changed = jdbcTemplate.update("""
            UPDATE account_invitation SET revoked_at=CURRENT_TIMESTAMP(6)
             WHERE id=? AND company_id=? AND accepted_at IS NULL AND revoked_at IS NULL
            """, id, actor.companyId());
        if (changed == 0) throw new NotFoundException("초대를 찾을 수 없습니다.");
        audit.record(actor, "INVITATION_REVOKED", "ACCOUNT_INVITATION", id, Map.of());
    }

    @Transactional
    public UserSummary updateUser(CurrentUser actor, long userId, UpdateUserRequest request) {
        requireAdmin(actor);
        ManagedUser target = jdbcTemplate.query("""
            SELECT id,company_id,email,role FROM app_user WHERE id=? AND company_id=?
            """, rs -> rs.next() ? new ManagedUser(rs.getLong("id"), rs.getLong("company_id"),
                rs.getString("email"), rs.getString("role")) : null, userId, actor.companyId());
        if (target == null) throw new NotFoundException("사용자를 찾을 수 없습니다.");
        if ("SUPER_ADMIN".equals(target.role())) throw new ForbiddenException("최고관리자 계정은 변경할 수 없습니다.");
        if (!actor.isSuperAdmin() && "ADMIN".equals(target.role())) {
            throw new ForbiddenException("관리자 계정은 최고관리자만 변경할 수 있습니다.");
        }
        String role = normalizeRole(request.role());
        if (!actor.isSuperAdmin() && "ADMIN".equals(role)) {
            throw new ForbiddenException("관리자 권한 부여는 최고관리자만 할 수 있습니다.");
        }
        String status = request.status().trim().toUpperCase(Locale.ROOT);
        if (!STATUSES.contains(status)) throw new BadRequestException("올바르지 않은 계정 상태입니다.");
        List<String> siteIds = validateSites(actor.companyId(), request.siteIds());
        jdbcTemplate.update("UPDATE app_user SET role=?,status=?,updated_at=CURRENT_TIMESTAMP(6) WHERE id=?",
            role, status, userId);
        jdbcTemplate.update("DELETE FROM user_site WHERE user_id=?", userId);
        if ("USER".equals(role)) {
            for (String siteId : siteIds) {
                jdbcTemplate.update("INSERT INTO user_site (user_id,site_id) VALUES (?,?)", userId, siteId);
            }
        }
        jdbcTemplate.update("UPDATE user_session SET revoked_at=CURRENT_TIMESTAMP(6) WHERE user_id=? AND revoked_at IS NULL",
            userId);
        audit.record(actor, "ACCOUNT_UPDATED", "APP_USER", Long.toString(userId),
            Map.of("role", role, "status", status, "siteIds", siteIds));
        return users(actor).stream().filter(user -> user.id() == userId).findFirst().orElseThrow();
    }

    @Transactional
    public PasswordResetCreated createPasswordReset(CurrentUser actor, long userId) {
        requireAdmin(actor);
        ManagedUser target = jdbcTemplate.query("""
            SELECT id,company_id,email,role FROM app_user WHERE id=? AND company_id=?
            """, rs -> rs.next() ? new ManagedUser(rs.getLong("id"), rs.getLong("company_id"),
                rs.getString("email"), rs.getString("role")) : null, userId, actor.companyId());
        if (target == null || target.email() == null) throw new NotFoundException("사용자를 찾을 수 없습니다.");
        if ("SUPER_ADMIN".equals(target.role()) && target.id() != actor.id()) {
            throw new ForbiddenException("다른 최고관리자의 비밀번호를 초기화할 수 없습니다.");
        }
        if (!actor.isSuperAdmin() && "ADMIN".equals(target.role())) {
            throw new ForbiddenException("관리자 비밀번호 초기화는 최고관리자만 할 수 있습니다.");
        }
        jdbcTemplate.update("UPDATE password_reset_token SET revoked_at=CURRENT_TIMESTAMP(6) WHERE user_id=? AND used_at IS NULL AND revoked_at IS NULL", userId);
        String token = secureTokens.create();
        Instant expiresAt = Instant.now().plus(1, ChronoUnit.HOURS);
        jdbcTemplate.update("""
            INSERT INTO password_reset_token (id,user_id,token_hash,created_by,expires_at,created_at)
            VALUES (?,?,?,?,?,CURRENT_TIMESTAMP(6))
            """, UUID.randomUUID().toString(), userId, secureTokens.hash(token), actor.id(), Timestamp.from(expiresAt));
        audit.record(actor, "PASSWORD_RESET_CREATED", "APP_USER", Long.toString(userId), Map.of("email", target.email()));
        return new PasswordResetCreated(token, target.email(), expiresAt);
    }

    private List<String> validateSites(long companyId, List<String> requested) {
        List<String> normalized = new ArrayList<>(new LinkedHashSet<>(requested == null ? List.of() : requested));
        if (normalized.isEmpty()) return normalized;
        Set<String> allowed = new LinkedHashSet<>(jdbcTemplate.query(
            "SELECT site_id FROM company_site WHERE company_id=?", (rs, row) -> rs.getString(1), companyId));
        if (!allowed.containsAll(normalized)) throw new BadRequestException("유효하지 않은 사업장이 포함되어 있습니다.");
        return normalized;
    }

    private String normalizeRole(String value) {
        String role = value.trim().toUpperCase(Locale.ROOT);
        if (!MANAGED_ROLES.contains(role)) throw new BadRequestException("올바르지 않은 권한입니다.");
        return role;
    }

    private void requireAdmin(CurrentUser actor) {
        if (!actor.isAdmin()) throw new ForbiddenException("관리자 권한이 필요합니다.");
    }

    private List<String> userSites(long userId) {
        return jdbcTemplate.query("SELECT site_id FROM user_site WHERE user_id=? ORDER BY site_id",
            (rs, row) -> rs.getString(1), userId);
    }

    private List<String> invitationSites(String invitationId) {
        return jdbcTemplate.query("SELECT site_id FROM account_invitation_site WHERE invitation_id=? ORDER BY site_id",
            (rs, row) -> rs.getString(1), invitationId);
    }

    private static Instant instant(Timestamp value) { return value == null ? null : value.toInstant(); }
    private record ManagedUser(long id, long companyId, String email, String role) {}
}
