package com.pentaworks.monitoring.platform;

import com.pentaworks.monitoring.admin.AccountMailService;
import com.pentaworks.monitoring.admin.AuditService;
import com.pentaworks.monitoring.auth.CurrentUserService.CurrentUser;
import com.pentaworks.monitoring.auth.SecureTokens;
import com.pentaworks.monitoring.auth.SessionRegistry;
import com.pentaworks.monitoring.common.BadRequestException;
import com.pentaworks.monitoring.common.ConflictException;
import com.pentaworks.monitoring.common.ForbiddenException;
import com.pentaworks.monitoring.common.NotFoundException;
import com.pentaworks.monitoring.platform.CompanyDocumentStorage.StoredDocument;
import com.pentaworks.monitoring.platform.PlatformCompanyController.CompanyCreated;
import com.pentaworks.monitoring.platform.PlatformCompanyController.CompanyDocument;
import com.pentaworks.monitoring.platform.PlatformCompanyController.CompanySummary;
import com.pentaworks.monitoring.platform.PlatformCompanyController.CreateCompanyRequest;
import com.pentaworks.monitoring.platform.PlatformCompanyController.InvitationCreated;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PlatformCompanyService {
    private final JdbcTemplate jdbcTemplate;
    private final SecureTokens secureTokens;
    private final AccountMailService mail;
    private final AuditService audit;
    private final CompanyDocumentStorage documents;
    private final SessionRegistry sessions;

    public PlatformCompanyService(JdbcTemplate jdbcTemplate, SecureTokens secureTokens, AccountMailService mail,
                                  AuditService audit, CompanyDocumentStorage documents, SessionRegistry sessions) {
        this.jdbcTemplate = jdbcTemplate;
        this.secureTokens = secureTokens;
        this.mail = mail;
        this.audit = audit;
        this.documents = documents;
        this.sessions = sessions;
    }

    public List<CompanySummary> companies(CurrentUser actor) {
        requirePlatformAdmin(actor);
        return jdbcTemplate.query("""
            SELECT c.id,c.code,c.name,c.business_registration_number,c.business_registration_url,c.status,
                   c.created_at,c.business_registration_uploaded_at,c.business_registration_verified_at,
                   (SELECT COUNT(*) FROM company_site cs WHERE cs.company_id=c.id) AS site_count,
                   (SELECT COUNT(*) FROM app_user u WHERE u.company_id=c.id AND u.status<>'DELETED') AS user_count,
                   (SELECT COUNT(*) FROM app_user u WHERE u.company_id=c.id
                       AND u.role IN ('PLATFORM_ADMIN','SUPER_ADMIN') AND u.status<>'DELETED') AS super_admin_count,
                   i.id AS invitation_id,i.email AS invitation_email,i.expires_at AS invitation_expires_at
              FROM company c
              LEFT JOIN account_invitation i ON i.id=(
                   SELECT ai.id FROM account_invitation ai
                    WHERE ai.company_id=c.id AND ai.role='SUPER_ADMIN' AND ai.accepted_at IS NULL
                      AND ai.revoked_at IS NULL AND ai.expires_at>CURRENT_TIMESTAMP(6)
                    ORDER BY ai.created_at DESC LIMIT 1)
             ORDER BY CASE c.status WHEN 'PENDING' THEN 0 WHEN 'ACTIVE' THEN 1 ELSE 2 END,c.name,c.id
            """, (rs, row) -> new CompanySummary(rs.getLong("id"), rs.getString("code"), rs.getString("name"),
                rs.getString("business_registration_number"), rs.getString("business_registration_url"),
                rs.getString("status"), instant(rs.getTimestamp("created_at")),
                instant(rs.getTimestamp("business_registration_uploaded_at")),
                instant(rs.getTimestamp("business_registration_verified_at")), rs.getInt("site_count"),
                rs.getInt("user_count"), rs.getInt("super_admin_count"), rs.getString("invitation_id"),
                rs.getString("invitation_email"), instant(rs.getTimestamp("invitation_expires_at"))));
    }

    @Transactional
    public CompanyCreated create(CurrentUser actor, CreateCompanyRequest request) {
        requirePlatformAdmin(actor);
        String code = request.code().trim().toUpperCase(Locale.ROOT);
        String name = required(request.name(), 120, "회사명");
        String number = request.businessRegistrationNumber().replaceAll("[^0-9]", "");
        if (number.length() != 10) throw new BadRequestException("사업자등록번호 10자리를 입력해주세요.");
        String email = normalizeEmail(request.adminEmail());
        String adminName = required(request.adminName(), 80, "최초 최고관리자 이름");
        Integer companyDuplicate = jdbcTemplate.queryForObject("""
            SELECT COUNT(*) FROM company WHERE code=? OR business_registration_number=?
            """, Integer.class, code, number);
        if (companyDuplicate != null && companyDuplicate > 0) {
            throw new ConflictException("회사 코드 또는 사업자등록번호가 이미 등록되어 있습니다.");
        }
        Integer accountDuplicate = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM app_user WHERE email=?",
            Integer.class, email);
        if (accountDuplicate != null && accountDuplicate > 0) throw new ConflictException("이미 가입된 이메일입니다.");
        Integer invitationDuplicate = jdbcTemplate.queryForObject("""
            SELECT COUNT(*) FROM account_invitation
             WHERE email=? AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>CURRENT_TIMESTAMP(6)
            """, Integer.class, email);
        if (invitationDuplicate != null && invitationDuplicate > 0) {
            throw new ConflictException("이미 유효한 초대가 있는 이메일입니다.");
        }

        StoredDocument stored = documents.store(request.businessRegistration());
        try {
            jdbcTemplate.update("""
                INSERT INTO company
                    (code,name,business_registration_number,business_registration_storage_key,
                     business_registration_original_name,business_registration_content_type,
                     business_registration_uploaded_at,status,created_at,updated_at)
                VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP(6),'PENDING',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6))
                """, code, name, number, stored.key(), stored.originalName(), stored.contentType());
            Long companyId = jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Long.class);
            if (companyId == null) throw new IllegalStateException("회사를 생성하지 못했습니다.");
            String registrationUrl = "/api/v1/platform/companies/" + companyId + "/business-registration";
            jdbcTemplate.update("UPDATE company SET business_registration_url=? WHERE id=?", registrationUrl, companyId);
            InvitationData invitation = createInvitation(companyId, email, adminName, actor.id());
            audit.recordForCompany(companyId, actor, "COMPANY_CREATED", "COMPANY", Long.toString(companyId),
                Map.of("code", code, "name", name, "businessRegistrationNumber", number,
                    "initialSuperAdmin", email));
            CompanySummary company = findCompany(actor, companyId);
            return new CompanyCreated(company, invitation.token(), email, invitation.expiresAt(),
                invitation.deliveryStatus());
        } catch (DuplicateKeyException error) {
            documents.deleteQuietly(stored.key());
            throw new ConflictException("회사 코드, 사업자등록번호 또는 관리자 이메일이 이미 등록되어 있습니다.");
        } catch (RuntimeException error) {
            documents.deleteQuietly(stored.key());
            throw error;
        }
    }

    @Transactional
    public InvitationCreated resend(CurrentUser actor, long companyId) {
        requirePlatformAdmin(actor);
        PendingCompany company = pendingCompany(companyId, true);
        PendingInvitation invitation = jdbcTemplate.query("""
            SELECT id,email,name FROM account_invitation
             WHERE company_id=? AND role='SUPER_ADMIN' AND accepted_at IS NULL AND revoked_at IS NULL
             ORDER BY created_at DESC LIMIT 1 FOR UPDATE
            """, rs -> rs.next() ? new PendingInvitation(rs.getString("id"), rs.getString("email"),
                rs.getString("name")) : null, companyId);
        if (invitation == null) throw new NotFoundException("재발송할 최초 최고관리자 초대를 찾을 수 없습니다.");
        String token = secureTokens.create();
        Instant expiresAt = Instant.now().plus(7, ChronoUnit.DAYS);
        jdbcTemplate.update("""
            UPDATE account_invitation SET token_hash=?,expires_at=?,created_at=CURRENT_TIMESTAMP(6) WHERE id=?
            """, secureTokens.hash(token), Timestamp.from(expiresAt), invitation.id());
        String delivery = mail.sendInvitation(invitation.email(), invitation.name(), token).name();
        audit.recordForCompany(companyId, actor, "COMPANY_ADMIN_INVITATION_RESENT", "COMPANY", Long.toString(companyId),
            Map.of("email", invitation.email(), "deliveryStatus", delivery));
        return new InvitationCreated(token, invitation.email(), expiresAt, delivery);
    }

    @Transactional
    public CompanySummary updateStatus(CurrentUser actor, long companyId, String rawStatus) {
        requirePlatformAdmin(actor);
        if (companyId == actor.companyId()) throw new BadRequestException("현재 플랫폼 관리 회사는 중지할 수 없습니다.");
        String status = rawStatus.trim().toUpperCase(Locale.ROOT);
        if (!List.of("ACTIVE", "SUSPENDED").contains(status)) throw new BadRequestException("올바르지 않은 회사 상태입니다.");
        PendingCompany company = company(companyId, true);
        if ("PENDING".equals(company.status())) throw new BadRequestException("최초 최고관리자 가입 전에는 상태를 변경할 수 없습니다.");
        if ("ACTIVE".equals(status)) {
            Integer admins = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM app_user WHERE company_id=? AND role='SUPER_ADMIN' AND status='ACTIVE'
                """, Integer.class, companyId);
            if (admins == null || admins < 1) throw new BadRequestException("활성 최고관리자가 없는 회사는 활성화할 수 없습니다.");
        }
        jdbcTemplate.update("UPDATE company SET status=?,updated_at=CURRENT_TIMESTAMP(6) WHERE id=?", status, companyId);
        if ("SUSPENDED".equals(status)) {
            List<Long> userIds = jdbcTemplate.query("SELECT id FROM app_user WHERE company_id=?",
                (rs, row) -> rs.getLong(1), companyId);
            jdbcTemplate.update("""
                UPDATE user_session s JOIN app_user u ON u.id=s.user_id
                   SET s.revoked_at=CURRENT_TIMESTAMP(6)
                 WHERE u.company_id=? AND s.revoked_at IS NULL
                """, companyId);
            userIds.forEach(sessions::invalidateUser);
        }
        audit.recordForCompany(companyId, actor, "COMPANY_STATUS_CHANGED", "COMPANY", Long.toString(companyId),
            Map.of("before", company.status(), "after", status));
        return findCompany(actor, companyId);
    }

    @Transactional
    public CompanySummary verifyRegistration(CurrentUser actor, long companyId) {
        requirePlatformAdmin(actor);
        PendingCompany company = company(companyId, true);
        if (company.storageKey() == null) throw new NotFoundException("사업자등록증이 없습니다.");
        jdbcTemplate.update("""
            UPDATE company SET business_registration_verified_at=CURRENT_TIMESTAMP(6),
                   business_registration_verified_by=?,updated_at=CURRENT_TIMESTAMP(6) WHERE id=?
            """, actor.id(), companyId);
        audit.recordForCompany(companyId, actor, "BUSINESS_REGISTRATION_VERIFIED", "COMPANY",
            Long.toString(companyId), Map.of());
        return findCompany(actor, companyId);
    }

    public CompanyDocument registration(CurrentUser actor, long companyId) {
        requirePlatformAdmin(actor);
        PendingCompany company = company(companyId, false);
        if (company.storageKey() == null) throw new NotFoundException("사업자등록증이 없습니다.");
        return new CompanyDocument(documents.read(company.storageKey()), company.originalName(), company.contentType());
    }

    private InvitationData createInvitation(long companyId, String email, String name, long actorId) {
        String id = UUID.randomUUID().toString();
        String token = secureTokens.create();
        Instant expiresAt = Instant.now().plus(7, ChronoUnit.DAYS);
        jdbcTemplate.update("""
            INSERT INTO account_invitation
                (id,company_id,email,name,role,token_hash,invited_by,expires_at,created_at)
            VALUES (?,?,?,?,'SUPER_ADMIN',?,?,?,CURRENT_TIMESTAMP(6))
            """, id, companyId, email, name, secureTokens.hash(token), actorId, Timestamp.from(expiresAt));
        String delivery = mail.sendInvitation(email, name, token).name();
        return new InvitationData(token, expiresAt, delivery);
    }

    private CompanySummary findCompany(CurrentUser actor, long companyId) {
        return companies(actor).stream().filter(value -> value.id() == companyId).findFirst()
            .orElseThrow(() -> new NotFoundException("회사를 찾을 수 없습니다."));
    }

    private PendingCompany pendingCompany(long companyId, boolean forUpdate) {
        PendingCompany value = company(companyId, forUpdate);
        if (!"PENDING".equals(value.status())) throw new BadRequestException("가입 대기 중인 회사가 아닙니다.");
        return value;
    }

    private PendingCompany company(long companyId, boolean forUpdate) {
        String suffix = forUpdate ? " FOR UPDATE" : "";
        PendingCompany value = jdbcTemplate.query("""
            SELECT id,status,business_registration_storage_key,business_registration_original_name,
                   business_registration_content_type FROM company WHERE id=?
            """ + suffix, rs -> rs.next() ? new PendingCompany(rs.getLong("id"), rs.getString("status"),
                rs.getString("business_registration_storage_key"),
                rs.getString("business_registration_original_name"),
                rs.getString("business_registration_content_type")) : null, companyId);
        if (value == null) throw new NotFoundException("회사를 찾을 수 없습니다.");
        return value;
    }

    private void requirePlatformAdmin(CurrentUser actor) {
        if (!actor.isPlatformAdmin()) throw new ForbiddenException("플랫폼 관리자 권한이 필요합니다.");
    }

    private String required(String value, int maxLength, String label) {
        String normalized = value == null ? "" : value.trim();
        if (normalized.isEmpty() || normalized.length() > maxLength) throw new BadRequestException(label + "을(를) 확인해주세요.");
        return normalized;
    }

    private String normalizeEmail(String value) {
        String email = value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
        if (email.length() > 254 || !email.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) {
            throw new BadRequestException("올바른 이메일을 입력해주세요.");
        }
        return email;
    }

    private static Instant instant(Timestamp value) { return value == null ? null : value.toInstant(); }
    private record InvitationData(String token, Instant expiresAt, String deliveryStatus) {}
    private record PendingInvitation(String id, String email, String name) {}
    private record PendingCompany(long id, String status, String storageKey, String originalName,
                                  String contentType) {}
}
