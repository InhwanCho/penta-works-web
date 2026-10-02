package com.pentaworks.monitoring.alert;

import com.pentaworks.monitoring.admin.AuditService;
import com.pentaworks.monitoring.auth.CurrentUserService;
import com.pentaworks.monitoring.auth.CurrentUserService.CurrentUser;
import com.pentaworks.monitoring.common.BadRequestException;
import com.pentaworks.monitoring.common.ConflictException;
import com.pentaworks.monitoring.common.ForbiddenException;
import com.pentaworks.monitoring.common.NotFoundException;
import java.sql.Time;
import java.time.LocalTime;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AlertRecipientService {
    private static final String KAKAO = "KAKAO_ALIMTALK";
    private final JdbcTemplate jdbcTemplate;
    private final CurrentUserService currentUsers;
    private final AuditService audit;

    public AlertRecipientService(JdbcTemplate jdbcTemplate, CurrentUserService currentUsers, AuditService audit) {
        this.jdbcTemplate = jdbcTemplate;
        this.currentUsers = currentUsers;
        this.audit = audit;
    }

    public List<RecipientSummary> recipients(CurrentUser actor) {
        Set<String> allowed = currentUsers.allowedSiteIds(actor);
        if (allowed.isEmpty()) return List.of();
        String placeholders = String.join(",", Collections.nCopies(allowed.size(), "?"));
        java.util.ArrayList<Object> args = new java.util.ArrayList<>(allowed);
        if (!actor.isAdmin()) args.add(actor.id());
        return jdbcTemplate.query("""
            SELECT r.id,r.site_id,s.name AS site_name,r.user_id,u.name AS user_name,r.channel,
                   r.destination,r.quiet_start,r.quiet_end,r.is_enabled
              FROM site_alert_recipient r
              LEFT JOIN site s ON s.site=r.site_id
              JOIN app_user u ON u.id=r.user_id
             WHERE r.site_id IN (%s) AND r.channel='KAKAO_ALIMTALK' %s
             ORDER BY r.site_id,r.priority,r.id
            """.formatted(placeholders, actor.isAdmin() ? "" : "AND r.user_id=?"), (rs, row) -> new RecipientSummary(
                rs.getLong("id"), rs.getString("site_id"), rs.getString("site_name"), rs.getLong("user_id"),
                rs.getString("user_name"), rs.getString("channel"), mask(rs.getString("destination")), rs.getString("destination"),
                localTime(rs.getTime("quiet_start")), localTime(rs.getTime("quiet_end")), rs.getBoolean("is_enabled")),
            args.toArray());
    }

    @Transactional
    public RecipientSummary create(CurrentUser actor, CreateRecipient request) {
        currentUsers.requireSiteAccess(actor, request.siteId());
        String channel = request.channel();
        if (!KAKAO.equals(channel)) throw new BadRequestException("알림톡 수신처만 등록할 수 있습니다.");
        String destination = validatePhone(request.destination());
        validateQuietHours(request.quietStart(), request.quietEnd());
        long owner = request.userId() == null ? actor.id() : request.userId();
        if (!actor.isAdmin() && owner != actor.id()) throw new ForbiddenException("본인 수신처만 등록할 수 있습니다.");
        CurrentUser assigned = jdbcTemplate.query("SELECT id,company_id,email,name,role,status FROM app_user WHERE id=? AND status='ACTIVE'",
            rs -> rs.next() ? new CurrentUser(rs.getLong(1), rs.getLong(2), rs.getString(3), rs.getString(4), rs.getString(5), rs.getString(6)) : null, owner);
        if (assigned == null || assigned.companyId() != actor.companyId())
            throw new BadRequestException("같은 회사의 활성 담당자를 선택해주세요.");
        currentUsers.requireSiteAccess(assigned, request.siteId());
        Integer existing = jdbcTemplate.queryForObject("""
            SELECT COUNT(*) FROM site_alert_recipient
             WHERE site_id=? AND channel=? AND destination=?
            """, Integer.class, request.siteId(), channel, destination);
        if (existing != null && existing > 0) {
            throw new ConflictException("이미 등록된 수신 채널입니다.");
        }
        jdbcTemplate.update("""
            INSERT INTO site_alert_recipient
                (site_id,user_id,channel,destination,priority,quiet_start,quiet_end,is_enabled,created_at,updated_at)
            VALUES (?,?,?, ?,0,?,?,?,CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6))
            """, request.siteId(), owner, channel, destination, time(request.quietStart()),
            time(request.quietEnd()), request.enabled());
        long id = jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Long.class);
        audit.record(actor, "ALERT_RECIPIENT_CREATED", "SITE_ALERT_RECIPIENT", Long.toString(id),
            Map.of("siteId", request.siteId(), "channel", channel));
        return recipient(actor, id);
    }

    @Transactional
    public RecipientSummary update(CurrentUser actor, long id, UpdateRecipient request) {
        RecipientTarget target = target(id);
        if (!actor.isAdmin() && target.userId() != actor.id()) throw new NotFoundException("본인 수신처만 변경할 수 있습니다.");
        currentUsers.requireSiteAccess(actor, target.siteId());
        long owner = request.userId() == null ? target.userId() : request.userId();
        if (!actor.isAdmin() && owner != actor.id()) throw new ForbiddenException("본인 수신처만 변경할 수 있습니다.");
        if (owner != target.userId()) {
            CurrentUser assigned = jdbcTemplate.query("SELECT id,company_id,email,name,role,status FROM app_user WHERE id=? AND status='ACTIVE'",
                rs -> rs.next() ? new CurrentUser(rs.getLong(1), rs.getLong(2), rs.getString(3), rs.getString(4), rs.getString(5), rs.getString(6)) : null, owner);
            if (assigned == null || assigned.companyId() != actor.companyId()) throw new BadRequestException("같은 회사의 활성 담당자를 선택해주세요.");
            currentUsers.requireSiteAccess(assigned, target.siteId());
        }
        validateQuietHours(request.quietStart(), request.quietEnd());
        String destination = request.destination() == null ? target.destination() : validatePhone(request.destination());
        Integer duplicates = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM site_alert_recipient WHERE site_id=? AND channel=? AND destination=? AND id<>?", Integer.class, target.siteId(), KAKAO, destination, id);
        if (duplicates != null && duplicates > 0) throw new ConflictException("이미 등록된 수신 번호입니다.");
        jdbcTemplate.update("""
            UPDATE site_alert_recipient
               SET user_id=?,destination=?,quiet_start=?,quiet_end=?,is_enabled=?,updated_at=CURRENT_TIMESTAMP(6)
             WHERE id=?
            """, owner, destination,
            time(request.quietStart()), time(request.quietEnd()), request.enabled(), id);
        audit.record(actor, "ALERT_RECIPIENT_UPDATED", "SITE_ALERT_RECIPIENT", Long.toString(id),
            Map.of("siteId", target.siteId(), "enabled", request.enabled()));
        return recipient(actor, id);
    }

    @Transactional
    public void delete(CurrentUser actor, long id) {
        RecipientTarget target = target(id);
        if (!actor.isAdmin() && target.userId() != actor.id()) throw new NotFoundException("본인 수신처만 변경할 수 있습니다.");
        currentUsers.requireSiteAccess(actor, target.siteId());
        jdbcTemplate.update("DELETE FROM site_alert_recipient WHERE id=?", id);
        audit.record(actor, "ALERT_RECIPIENT_DELETED", "SITE_ALERT_RECIPIENT", Long.toString(id),
            Map.of("siteId", target.siteId()));
    }

    public List<String> activePhones(String siteId, LocalTime now, long eventId) {
        List<String> candidates = activePhones(siteId, now);
        List<String> suppressed = jdbcTemplate.query("""
            SELECT r.destination FROM site_alert_recipient r
              JOIN alert_event_acknowledgement a ON a.user_id=r.user_id AND a.event_id=?
             WHERE r.site_id=? AND r.channel=\'KAKAO_ALIMTALK\'
            """, (rs, row) -> rs.getString(1), eventId, siteId);
        return candidates.stream().filter(phone -> !suppressed.contains(phone)).toList();
    }

    public List<String> activePhones(String siteId, LocalTime now) {
        return activeDestinations(siteId, now, KAKAO);
    }

    private List<String> activeDestinations(String siteId, LocalTime now, String channel) {
        List<RecipientWindow> rows = jdbcTemplate.query("""
            SELECT r.destination,r.quiet_start,r.quiet_end
              FROM site_alert_recipient r
              JOIN app_user u ON u.id=r.user_id AND u.status='ACTIVE'
              JOIN company c ON c.id=u.company_id AND c.status='ACTIVE'
              JOIN company_site cs ON cs.site_id=r.site_id AND cs.company_id=u.company_id
             WHERE r.site_id=? AND r.channel=? AND r.is_enabled=TRUE
               AND (u.role IN ('PLATFORM_ADMIN','SUPER_ADMIN','ADMIN') OR EXISTS (
                    SELECT 1 FROM user_site us WHERE us.user_id=u.id AND us.site_id=r.site_id))
             ORDER BY r.priority,r.id
            """, (rs, row) -> new RecipientWindow(rs.getString("destination"),
                localTime(rs.getTime("quiet_start")), localTime(rs.getTime("quiet_end"))), siteId, channel);
        LinkedHashSet<String> result = new LinkedHashSet<>();
        rows.stream().filter(row -> !isQuiet(now, row.start(), row.end())).forEach(row -> result.add(row.destination()));
        return List.copyOf(result);
    }

    public boolean hasConfiguredPhones(String siteId) {
        Integer count = jdbcTemplate.queryForObject("""
            SELECT COUNT(*) FROM site_alert_recipient WHERE site_id=? AND channel=?
            """, Integer.class, siteId, KAKAO);
        return count != null && count > 0;
    }

    private RecipientSummary recipient(CurrentUser actor, long id) {
        return recipients(actor).stream().filter(recipient -> recipient.id() == id).findFirst()
            .orElseThrow(() -> new NotFoundException("알림 수신자를 찾을 수 없습니다."));
    }

    private RecipientTarget target(long id) {
        RecipientTarget target = jdbcTemplate.query("SELECT site_id,user_id,destination FROM site_alert_recipient WHERE id=? AND channel='KAKAO_ALIMTALK'",
            rs -> rs.next() ? new RecipientTarget(rs.getString(1), rs.getLong(2), rs.getString(3)) : null, id);
        if (target == null) throw new NotFoundException("알림 수신자를 찾을 수 없습니다.");
        return target;
    }

    private static String validatePhone(String raw) {
        String value = raw == null ? "" : raw.replaceAll("[-\\s]", "");
        if (!value.matches("01[016789][0-9]{7,8}")) {
            throw new BadRequestException("휴대폰 번호를 확인해주세요.");
        }
        return value;
    }

    private static void validateQuietHours(LocalTime start, LocalTime end) {
        if ((start == null) != (end == null)) throw new BadRequestException("조용한 시간의 시작과 종료를 모두 입력해주세요.");
        if (start != null && start.equals(end)) throw new BadRequestException("조용한 시간의 시작과 종료는 다르게 지정해주세요. 항상 받으려면 조용한 시간을 해제하세요.");
    }

    private static boolean isQuiet(LocalTime now, LocalTime start, LocalTime end) {
        if (start == null || end == null || start.equals(end)) return false;
        return start.isBefore(end) ? !now.isBefore(start) && now.isBefore(end)
            : !now.isBefore(start) || now.isBefore(end);
    }

    private static String mask(String value) {
        int keep = Math.min(6, value.length());
        return "••••••" + value.substring(value.length() - keep);
    }

    private static Time time(LocalTime value) { return value == null ? null : Time.valueOf(value); }
    private static LocalTime localTime(Time value) { return value == null ? null : value.toLocalTime(); }

    private record RecipientTarget(String siteId, long userId, String destination) {}
    private record RecipientWindow(String destination, LocalTime start, LocalTime end) {}
    public record RecipientSummary(long id, String siteId, String siteName, long userId, String userName,
                                   String channel, String destinationMasked, String destination, LocalTime quietStart,
                                   LocalTime quietEnd, boolean enabled) {}
    public record CreateRecipient(String siteId, String channel, String destination, LocalTime quietStart,
                                  LocalTime quietEnd, boolean enabled, Long userId) {
        public CreateRecipient(String siteId, String channel, String destination, LocalTime start, LocalTime end, boolean enabled) {
            this(siteId, channel, destination, start, end, enabled, null);
        }
        public CreateRecipient(String siteId, String destination, LocalTime quietStart,
                               LocalTime quietEnd, boolean enabled) {
            this(siteId, KAKAO, destination, quietStart, quietEnd, enabled, null);
        }
    }
    public record UpdateRecipient(LocalTime quietStart, LocalTime quietEnd, boolean enabled, String destination, Long userId) {
        public UpdateRecipient(LocalTime start, LocalTime end, boolean enabled) { this(start, end, enabled, null, null); }
    }
}
