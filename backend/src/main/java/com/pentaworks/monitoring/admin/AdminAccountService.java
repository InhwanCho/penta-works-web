package com.pentaworks.monitoring.admin;

import com.pentaworks.monitoring.admin.AdminAccountController.AuditSummary;
import com.pentaworks.monitoring.admin.AdminAccountController.CreateSiteRequest;
import com.pentaworks.monitoring.admin.AdminAccountController.CompanySummary;
import com.pentaworks.monitoring.admin.AdminAccountController.InvitationCreated;
import com.pentaworks.monitoring.admin.AdminAccountController.InvitationSummary;
import com.pentaworks.monitoring.admin.AdminAccountController.InviteRequest;
import com.pentaworks.monitoring.admin.AdminAccountController.PasswordResetCreated;
import com.pentaworks.monitoring.admin.AdminAccountController.SiteOption;
import com.pentaworks.monitoring.admin.AdminAccountController.UpdateSiteRequest;
import com.pentaworks.monitoring.admin.AdminAccountController.UpdateUserRequest;
import com.pentaworks.monitoring.admin.AdminAccountController.UserSummary;
import com.pentaworks.monitoring.auth.CurrentUserService.CurrentUser;
import com.pentaworks.monitoring.auth.SecureTokens;
import com.pentaworks.monitoring.auth.SessionRegistry;
import com.pentaworks.monitoring.common.BadRequestException;
import com.pentaworks.monitoring.common.ConflictException;
import com.pentaworks.monitoring.common.ForbiddenException;
import com.pentaworks.monitoring.common.NotFoundException;
import com.pentaworks.monitoring.dashboard.DashboardService;
import com.pentaworks.monitoring.alert.AlertEventService;
import java.sql.Timestamp;
import java.time.DateTimeException;
import java.time.Instant;
import java.time.ZoneId;
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
    private static final Set<String> MANAGED_ROLES = Set.of("SUPER_ADMIN", "ADMIN", "USER");
    private static final Set<String> STATUSES = Set.of("ACTIVE", "SUSPENDED");

    private final JdbcTemplate jdbcTemplate;
    private final SecureTokens secureTokens;
    private final AuditService audit;
    private final DashboardService dashboard;
    private final AccountMailService mail;
    private final SessionRegistry sessions;
    private final AlertEventService alertEvents;

    public AdminAccountService(JdbcTemplate jdbcTemplate, SecureTokens secureTokens, AuditService audit,
                               DashboardService dashboard, AccountMailService mail, SessionRegistry sessions,
                               AlertEventService alertEvents) {
        this.jdbcTemplate = jdbcTemplate;
        this.secureTokens = secureTokens;
        this.audit = audit;
        this.dashboard = dashboard;
        this.mail = mail;
        this.sessions = sessions;
        this.alertEvents = alertEvents;
    }

    public List<UserSummary> users(CurrentUser actor) {
        requireAdmin(actor);
        return jdbcTemplate.query("""
            SELECT id,email,name,phone,role,status,last_login_at,created_at
              FROM app_user WHERE company_id=? AND email IS NOT NULL AND status<>'DELETED'
             ORDER BY CASE role WHEN 'PLATFORM_ADMIN' THEN 0 WHEN 'SUPER_ADMIN' THEN 1 WHEN 'ADMIN' THEN 2 ELSE 3 END,
                      name,email
            """, (rs, row) -> new UserSummary(rs.getLong("id"), rs.getString("email"), rs.getString("name"),
                rs.getString("phone"), rs.getString("role"), rs.getString("status"), instant(rs.getTimestamp("last_login_at")),
                instant(rs.getTimestamp("created_at")), userSites(rs.getLong("id"))), actor.companyId());
    }

    public CompanySummary company(CurrentUser actor) {
        requireAdmin(actor);
        CompanySummary company = jdbcTemplate.query("""
            SELECT id,code,name FROM company WHERE id=? AND status='ACTIVE'
            """, rs -> rs.next() ? new CompanySummary(rs.getLong("id"), rs.getString("code"),
                rs.getString("name")) : null, actor.companyId());
        if (company == null) throw new NotFoundException("회사를 찾을 수 없습니다.");
        return company;
    }

    public List<SiteOption> sites(CurrentUser actor) {
        requireAdmin(actor);
        return jdbcTemplate.query("""
            SELECT cs.site_id,cs.is_dashboard_visible,s.name,p.address,p.contact_name,p.contact_phone,
                   COALESCE(p.timezone,'Asia/Seoul') AS timezone,
                   c.id AS company_id,c.code AS company_code,c.name AS company_name
              FROM company_site cs
              JOIN company c ON c.id=cs.company_id
            LEFT JOIN site s ON s.site=cs.site_id
            LEFT JOIN site_profile p ON p.site_id=cs.site_id
            WHERE cs.company_id=? ORDER BY cs.site_id
            """, (rs, row) -> new SiteOption(rs.getString("site_id"), rs.getString("name"),
                rs.getString("address"), rs.getString("contact_name"), rs.getString("contact_phone"),
                rs.getString("timezone"), rs.getLong("company_id"), rs.getString("company_code"),
                rs.getString("company_name"), rs.getBoolean("is_dashboard_visible")), actor.companyId());
    }

    @Transactional
    public SiteOption createSite(CurrentUser actor, CreateSiteRequest request) {
        requireAdmin(actor);
        String siteId = request.id().trim();
        if (!siteId.matches("[A-Za-z0-9_-]{1,32}")) {
            throw new BadRequestException("사업장 코드는 영문, 숫자, 밑줄, 하이픈만 사용할 수 있습니다.");
        }
        if ("040".equals(siteId)) {
            throw new BadRequestException("040은 테스트 데이터 코드이므로 사업장으로 등록할 수 없습니다.");
        }
        SiteFields fields = validateSiteFields(request.name(), request.address(), request.contactName(),
            request.contactPhone(), request.timezone());
        Integer existing = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM site WHERE site=?", Integer.class, siteId);
        if (existing != null && existing > 0) throw new ConflictException("이미 등록된 사업장 코드입니다.");
        jdbcTemplate.update("INSERT INTO site (site,name) VALUES (?,?)", siteId, fields.name());
        jdbcTemplate.update("INSERT INTO company_site (company_id,site_id) VALUES (?,?)", actor.companyId(), siteId);
        jdbcTemplate.update("""
            INSERT INTO site_profile
                (site_id,display_name,address,contact_name,contact_phone,timezone,created_at,updated_at)
            VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6))
            """, siteId, fields.name(), fields.address(), fields.contactName(), fields.contactPhone(), fields.timezone());
        audit.record(actor, "SITE_CREATED", "SITE", siteId,
            Map.of("name", fields.name(), "timezone", fields.timezone()));
        dashboard.invalidateCache();
        return site(actor, siteId);
    }

    @Transactional
    public SiteOption updateSite(CurrentUser actor, String siteId, UpdateSiteRequest request) {
        requireAdmin(actor);
        requireManagedSite(actor, siteId);
        SiteFields fields = validateSiteFields(request.name(), request.address(), request.contactName(),
            request.contactPhone(), request.timezone());
        jdbcTemplate.update("UPDATE site SET name=? WHERE site=?", fields.name(), siteId);
        jdbcTemplate.update("""
            INSERT INTO site_profile
                (site_id,display_name,address,contact_name,contact_phone,timezone,created_at,updated_at)
            VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6))
            ON DUPLICATE KEY UPDATE display_name=VALUES(display_name),address=VALUES(address),
                contact_name=VALUES(contact_name),contact_phone=VALUES(contact_phone),
                timezone=VALUES(timezone),updated_at=CURRENT_TIMESTAMP(6)
            """, siteId, fields.name(), fields.address(), fields.contactName(), fields.contactPhone(), fields.timezone());
        audit.record(actor, "SITE_UPDATED", "SITE", siteId,
            Map.of("name", fields.name(), "timezone", fields.timezone()));
        dashboard.invalidateCache();
        return site(actor, siteId);
    }

    @Transactional
    public SiteOption updateSiteVisibility(CurrentUser actor, String siteId, boolean visible) {
        if (!actor.isSuperAdmin()) throw new ForbiddenException("회사 최고관리자 권한이 필요합니다.");
        requireManagedSite(actor, siteId);
        jdbcTemplate.update("UPDATE company_site SET is_dashboard_visible=? WHERE company_id=? AND site_id=?",
            visible, actor.companyId(), siteId);
        if (!visible) {
            jdbcTemplate.update("""
                INSERT INTO site_alert_policy (site_id,is_enabled,created_at,updated_at)
                VALUES (?,FALSE,CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6))
                ON DUPLICATE KEY UPDATE is_enabled=FALSE,updated_at=CURRENT_TIMESTAMP(6)
                """, siteId);
            alertEvents.disableSite(siteId);
        }
        audit.record(actor, "SITE_VISIBILITY_UPDATED", "SITE", siteId, Map.of("dashboardVisible", visible));
        dashboard.invalidateCache();
        return site(actor, siteId);
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
            SELECT id,actor_name,action,target_type,target_id,before_data,after_data,ip_address,created_at
              FROM audit_log WHERE company_id=? ORDER BY created_at DESC LIMIT 200
            """, (rs, row) -> new AuditSummary(rs.getLong("id"), rs.getString("actor_name"),
                rs.getString("action"), rs.getString("target_type"), rs.getString("target_id"),
                rs.getString("before_data"), rs.getString("after_data"), rs.getString("ip_address"),
                rs.getTimestamp("created_at").toInstant()), actor.companyId());
    }

    @Transactional
    public InvitationCreated invite(CurrentUser actor, InviteRequest request) {
        requireAdmin(actor);
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        String role = normalizeRole(request.role());
        if (!actor.isSuperAdmin() && !"USER".equals(role)) {
            throw new ForbiddenException("관리자와 최고관리자 초대는 최고관리자만 할 수 있습니다.");
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
        AccountMailService.DeliveryStatus delivery = mail.sendInvitation(email, request.name().trim(), token);
        audit.record(actor, "ACCOUNT_INVITED", "ACCOUNT_INVITATION", id,
            Map.of("email", email, "role", role, "siteIds", siteIds, "deliveryStatus", delivery.name()));
        return new InvitationCreated(id, token, email, expiresAt, delivery.name());
    }

    @Transactional
    public InvitationCreated resendInvitation(CurrentUser actor, String id) {
        requireAdmin(actor);
        PendingInvitation invitation = jdbcTemplate.query("""
            SELECT id,email,name,role FROM account_invitation
             WHERE id=? AND company_id=? AND accepted_at IS NULL AND revoked_at IS NULL
            """, rs -> rs.next() ? new PendingInvitation(rs.getString("id"), rs.getString("email"),
                rs.getString("name"), rs.getString("role")) : null, id, actor.companyId());
        if (invitation == null) throw new NotFoundException("초대를 찾을 수 없습니다.");
        if (!actor.isSuperAdmin() && !"USER".equals(invitation.role())) {
            throw new ForbiddenException("관리자와 최고관리자 초대는 최고관리자만 재발송할 수 있습니다.");
        }
        String token = secureTokens.create();
        Instant expiresAt = Instant.now().plus(7, ChronoUnit.DAYS);
        jdbcTemplate.update("""
            UPDATE account_invitation SET token_hash=?,expires_at=?,created_at=CURRENT_TIMESTAMP(6)
             WHERE id=?
            """, secureTokens.hash(token), Timestamp.from(expiresAt), id);
        AccountMailService.DeliveryStatus delivery = mail.sendInvitation(
            invitation.email(), invitation.name(), token);
        audit.record(actor, "INVITATION_RESENT", "ACCOUNT_INVITATION", id,
            Map.of("email", invitation.email(), "role", invitation.role(), "deliveryStatus", delivery.name()));
        return new InvitationCreated(id, token, invitation.email(), expiresAt, delivery.name());
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
            SELECT id,company_id,email,name,phone,role,status FROM app_user WHERE id=? AND company_id=? AND status<>'DELETED'
            """, rs -> rs.next() ? new ManagedUser(rs.getLong("id"), rs.getLong("company_id"),
                rs.getString("email"), rs.getString("name"), rs.getString("phone"), rs.getString("role"),
                rs.getString("status")) : null, userId, actor.companyId());
        if (target == null) throw new NotFoundException("사용자를 찾을 수 없습니다.");
        if ("PLATFORM_ADMIN".equals(target.role())) throw new ForbiddenException("플랫폼 관리자 계정은 변경할 수 없습니다.");
        if ("SUPER_ADMIN".equals(target.role())) throw new ForbiddenException("최고관리자 계정은 변경할 수 없습니다.");
        if (!actor.isSuperAdmin() && "ADMIN".equals(target.role())) {
            throw new ForbiddenException("관리자 계정은 최고관리자만 변경할 수 있습니다.");
        }
        String role = normalizeRole(request.role());
        if ("SUPER_ADMIN".equals(role)) {
            throw new BadRequestException("최고관리자는 초대로만 추가할 수 있습니다.");
        }
        if (!actor.isSuperAdmin() && "ADMIN".equals(role)) {
            throw new ForbiddenException("관리자 권한 부여는 최고관리자만 할 수 있습니다.");
        }
        String email = normalizeEmail(request.email());
        String name = required(request.name(), 80, "이름");
        String phone = optional(request.phone(), 30, "전화번호");
        Integer duplicate = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM app_user WHERE email=? AND id<>?", Integer.class, email, userId);
        if (duplicate != null && duplicate > 0) throw new ConflictException("이미 등록된 이메일입니다.");
        String status = request.status().trim().toUpperCase(Locale.ROOT);
        if (!STATUSES.contains(status)) throw new BadRequestException("올바르지 않은 계정 상태입니다.");
        List<String> siteIds = validateSites(actor.companyId(), request.siteIds());
        jdbcTemplate.update("""
            UPDATE app_user SET email=?,username=?,name=?,phone=?,role=?,status=?,updated_at=CURRENT_TIMESTAMP(6)
             WHERE id=?
            """, email, email, name, phone, role, status, userId);
        jdbcTemplate.update("DELETE FROM user_site WHERE user_id=?", userId);
        if ("USER".equals(role)) {
            for (String siteId : siteIds) {
                jdbcTemplate.update("INSERT INTO user_site (user_id,site_id) VALUES (?,?)", userId, siteId);
            }
        }
        jdbcTemplate.update("UPDATE user_session SET revoked_at=CURRENT_TIMESTAMP(6) WHERE user_id=? AND revoked_at IS NULL",
            userId);
        sessions.invalidateUser(userId);
        audit.record(actor, "ACCOUNT_UPDATED", "APP_USER", Long.toString(userId),
            Map.of("email", target.email(), "name", target.name(), "phone", target.phone() == null ? "" : target.phone(),
                "role", target.role(), "status", target.status()),
            Map.of("email", email, "name", name, "phone", phone == null ? "" : phone,
                "role", role, "status", status, "siteIds", siteIds));
        return users(actor).stream().filter(user -> user.id() == userId).findFirst().orElseThrow();
    }

    @Transactional
    public void deleteUser(CurrentUser actor, long userId) {
        requireAdmin(actor);
        ManagedUser target = jdbcTemplate.query("""
            SELECT id,company_id,email,name,phone,role,status FROM app_user
             WHERE id=? AND company_id=? AND status<>'DELETED' FOR UPDATE
            """, rs -> rs.next() ? new ManagedUser(rs.getLong("id"), rs.getLong("company_id"),
                rs.getString("email"), rs.getString("name"), rs.getString("phone"), rs.getString("role"),
                rs.getString("status")) : null,
            userId, actor.companyId());
        if (target == null) throw new NotFoundException("사용자를 찾을 수 없습니다.");
        if (target.id() == actor.id()) throw new BadRequestException("현재 로그인한 본인 계정은 삭제할 수 없습니다.");
        if ("PLATFORM_ADMIN".equals(target.role())) throw new ForbiddenException("플랫폼 관리자 계정은 삭제할 수 없습니다.");
        if ("SUPER_ADMIN".equals(target.role())) {
            if (!actor.isSuperAdmin()) throw new ForbiddenException("최고관리자 계정은 최고관리자만 삭제할 수 있습니다.");
            jdbcTemplate.queryForObject("SELECT id FROM company WHERE id=? FOR UPDATE", Long.class,
                actor.companyId());
            Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM app_user
                 WHERE company_id=? AND role IN ('PLATFORM_ADMIN','SUPER_ADMIN') AND status<>'DELETED'
                """, Integer.class, actor.companyId());
            if (count == null || count <= 1) throw new BadRequestException("마지막 최고관리자 계정은 삭제할 수 없습니다.");
        } else if ("ADMIN".equals(target.role()) && !actor.isSuperAdmin()) {
            throw new ForbiddenException("관리자 계정은 최고관리자만 삭제할 수 있습니다.");
        }
        audit.record(actor, "ACCOUNT_DELETED", "APP_USER", Long.toString(userId),
            Map.of("email", target.email(), "name", target.name(), "role", target.role()));
        jdbcTemplate.update("DELETE FROM user_site WHERE user_id=?", userId);
        jdbcTemplate.update("DELETE FROM site_alert_recipient WHERE user_id=?", userId);
        jdbcTemplate.update("UPDATE user_session SET revoked_at=CURRENT_TIMESTAMP(6) WHERE user_id=? AND revoked_at IS NULL", userId);
        sessions.invalidateUser(userId);
        jdbcTemplate.update("UPDATE password_reset_token SET revoked_at=CURRENT_TIMESTAMP(6) WHERE user_id=? AND used_at IS NULL AND revoked_at IS NULL", userId);
        String deletedIdentity = "deleted-" + userId + "-" + UUID.randomUUID() + "@deleted.invalid";
        jdbcTemplate.update("""
            UPDATE app_user SET email=?,username=?,name='삭제된 사용자',phone=NULL,role='USER',status='DELETED',
                   password_hash=?,failed_login_count=0,locked_until=NULL,updated_at=CURRENT_TIMESTAMP(6)
             WHERE id=?
            """, deletedIdentity, deletedIdentity, secureTokens.hash(secureTokens.create()), userId);
    }

    @Transactional
    public PasswordResetCreated createPasswordReset(CurrentUser actor, long userId) {
        requireAdmin(actor);
        ManagedUser target = jdbcTemplate.query("""
            SELECT id,company_id,email,name,phone,role,status FROM app_user WHERE id=? AND company_id=? AND status<>'DELETED'
            """, rs -> rs.next() ? new ManagedUser(rs.getLong("id"), rs.getLong("company_id"),
                rs.getString("email"), rs.getString("name"), rs.getString("phone"), rs.getString("role"),
                rs.getString("status")) : null, userId, actor.companyId());
        if (target == null || target.email() == null) throw new NotFoundException("사용자를 찾을 수 없습니다.");
        if ("PLATFORM_ADMIN".equals(target.role()) && target.id() != actor.id()) {
            throw new ForbiddenException("다른 플랫폼 관리자의 비밀번호를 초기화할 수 없습니다.");
        }
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
        AccountMailService.DeliveryStatus delivery = mail.sendPasswordReset(target.email(), target.name(), token);
        audit.record(actor, "PASSWORD_RESET_CREATED", "APP_USER", Long.toString(userId),
            Map.of("email", target.email(), "deliveryStatus", delivery.name()));
        return new PasswordResetCreated(token, target.email(), expiresAt, delivery.name());
    }

    private List<String> validateSites(long companyId, List<String> requested) {
        List<String> normalized = new ArrayList<>(new LinkedHashSet<>(requested == null ? List.of() : requested));
        if (normalized.isEmpty()) return normalized;
        Set<String> allowed = new LinkedHashSet<>(jdbcTemplate.query(
            "SELECT site_id FROM company_site WHERE company_id=?", (rs, row) -> rs.getString(1), companyId));
        if (!allowed.containsAll(normalized)) throw new BadRequestException("유효하지 않은 사업장이 포함되어 있습니다.");
        return normalized;
    }

    private SiteOption site(CurrentUser actor, String siteId) {
        return sites(actor).stream().filter(site -> site.id().equals(siteId)).findFirst()
            .orElseThrow(() -> new NotFoundException("사업장을 찾을 수 없습니다."));
    }

    private void requireManagedSite(CurrentUser actor, String siteId) {
        Integer count = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM company_site WHERE company_id=? AND site_id=?", Integer.class,
            actor.companyId(), siteId);
        if (count == null || count == 0) throw new NotFoundException("사업장을 찾을 수 없습니다.");
    }

    private SiteFields validateSiteFields(String rawName, String address, String contactName,
                                          String contactPhone, String rawTimezone) {
        String name = rawName == null ? "" : rawName.trim();
        if (name.isEmpty() || name.length() > 20) throw new BadRequestException("사업장 이름은 20자 이하여야 합니다.");
        String timezone = rawTimezone == null || rawTimezone.isBlank() ? "Asia/Seoul" : rawTimezone.trim();
        if (timezone.length() > 40) throw new BadRequestException("시간대 값을 확인해주세요.");
        try { ZoneId.of(timezone); } catch (DateTimeException error) {
            throw new BadRequestException("올바른 시간대를 입력해주세요.");
        }
        return new SiteFields(name, optional(address, 255, "주소"), optional(contactName, 80, "담당자 이름"),
            optional(contactPhone, 30, "담당자 연락처"), timezone);
    }

    private String optional(String value, int maxLength, String label) {
        if (value == null || value.isBlank()) return null;
        String normalized = value.trim();
        if (normalized.length() > maxLength) throw new BadRequestException(label + "이 너무 깁니다.");
        return normalized;
    }

    private String normalizeRole(String value) {
        String role = value.trim().toUpperCase(Locale.ROOT);
        if (!MANAGED_ROLES.contains(role)) throw new BadRequestException("올바르지 않은 권한입니다.");
        return role;
    }

    private String normalizeEmail(String value) {
        String email = value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
        if (email.isEmpty() || email.length() > 254 || !email.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) {
            throw new BadRequestException("올바른 이메일을 입력해주세요.");
        }
        return email;
    }

    private String required(String value, int maxLength, String label) {
        String normalized = value == null ? "" : value.trim();
        if (normalized.isEmpty() || normalized.length() > maxLength) {
            throw new BadRequestException(label + "을(를) 확인해주세요.");
        }
        return normalized;
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
    private record ManagedUser(long id, long companyId, String email, String name, String phone, String role,
                               String status) {}
    private record PendingInvitation(String id, String email, String name, String role) {}
    private record SiteFields(String name, String address, String contactName, String contactPhone,
                              String timezone) {}
}
