package com.pentaworks.monitoring.alert;

import com.pentaworks.monitoring.admin.AuditService;
import com.pentaworks.monitoring.auth.CurrentUserService;
import com.pentaworks.monitoring.auth.CurrentUserService.CurrentUser;
import com.pentaworks.monitoring.common.BadRequestException;
import com.pentaworks.monitoring.common.ConflictException;
import com.pentaworks.monitoring.common.ForbiddenException;
import com.pentaworks.monitoring.common.NotFoundException;
import java.net.URI;
import java.net.URISyntaxException;
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
    private static final String CHANNEL = "SLACK_WEBHOOK";
    private final JdbcTemplate jdbcTemplate;
    private final CurrentUserService currentUsers;
    private final AuditService audit;

    public AlertRecipientService(JdbcTemplate jdbcTemplate, CurrentUserService currentUsers, AuditService audit) {
        this.jdbcTemplate = jdbcTemplate;
        this.currentUsers = currentUsers;
        this.audit = audit;
    }

    public List<RecipientSummary> recipients(CurrentUser actor) {
        requireAdmin(actor);
        Set<String> allowed = currentUsers.allowedSiteIds(actor);
        if (allowed.isEmpty()) return List.of();
        String placeholders = String.join(",", Collections.nCopies(allowed.size(), "?"));
        return jdbcTemplate.query("""
            SELECT r.id,r.site_id,s.name AS site_name,r.user_id,u.name AS user_name,r.channel,
                   r.destination,r.quiet_start,r.quiet_end,r.is_enabled
              FROM site_alert_recipient r
              LEFT JOIN site s ON s.site=r.site_id
              JOIN app_user u ON u.id=r.user_id
             WHERE r.site_id IN (%s)
             ORDER BY r.site_id,r.priority,r.id
            """.formatted(placeholders), (rs, row) -> new RecipientSummary(
                rs.getLong("id"), rs.getString("site_id"), rs.getString("site_name"), rs.getLong("user_id"),
                rs.getString("user_name"), rs.getString("channel"), mask(rs.getString("destination")),
                localTime(rs.getTime("quiet_start")), localTime(rs.getTime("quiet_end")), rs.getBoolean("is_enabled")),
            allowed.toArray());
    }

    @Transactional
    public RecipientSummary create(CurrentUser actor, CreateRecipient request) {
        requireAdmin(actor);
        currentUsers.requireSiteAccess(actor, request.siteId());
        String destination = validateWebhook(request.destination());
        validateQuietHours(request.quietStart(), request.quietEnd());
        Integer existing = jdbcTemplate.queryForObject("""
            SELECT COUNT(*) FROM site_alert_recipient
             WHERE site_id=? AND channel=? AND destination=?
            """, Integer.class, request.siteId(), CHANNEL, destination);
        if (existing != null && existing > 0) {
            throw new ConflictException("이미 등록된 Slack 수신 채널입니다.");
        }
        jdbcTemplate.update("""
            INSERT INTO site_alert_recipient
                (site_id,user_id,channel,destination,priority,quiet_start,quiet_end,is_enabled,created_at,updated_at)
            VALUES (?,?,?, ?,0,?,?,?,CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6))
            """, request.siteId(), actor.id(), CHANNEL, destination, time(request.quietStart()),
            time(request.quietEnd()), request.enabled());
        long id = jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Long.class);
        audit.record(actor, "ALERT_RECIPIENT_CREATED", "SITE_ALERT_RECIPIENT", Long.toString(id),
            Map.of("siteId", request.siteId(), "channel", CHANNEL));
        return recipient(actor, id);
    }

    @Transactional
    public RecipientSummary update(CurrentUser actor, long id, UpdateRecipient request) {
        requireAdmin(actor);
        RecipientTarget target = target(id);
        currentUsers.requireSiteAccess(actor, target.siteId());
        validateQuietHours(request.quietStart(), request.quietEnd());
        jdbcTemplate.update("""
            UPDATE site_alert_recipient
               SET quiet_start=?,quiet_end=?,is_enabled=?,updated_at=CURRENT_TIMESTAMP(6)
             WHERE id=?
            """, time(request.quietStart()), time(request.quietEnd()), request.enabled(), id);
        audit.record(actor, "ALERT_RECIPIENT_UPDATED", "SITE_ALERT_RECIPIENT", Long.toString(id),
            Map.of("siteId", target.siteId(), "enabled", request.enabled()));
        return recipient(actor, id);
    }

    @Transactional
    public void delete(CurrentUser actor, long id) {
        requireAdmin(actor);
        RecipientTarget target = target(id);
        currentUsers.requireSiteAccess(actor, target.siteId());
        jdbcTemplate.update("DELETE FROM site_alert_recipient WHERE id=?", id);
        audit.record(actor, "ALERT_RECIPIENT_DELETED", "SITE_ALERT_RECIPIENT", Long.toString(id),
            Map.of("siteId", target.siteId()));
    }

    public List<String> activeWebhooks(String siteId, LocalTime now) {
        List<WebhookWindow> rows = jdbcTemplate.query("""
            SELECT destination,quiet_start,quiet_end
              FROM site_alert_recipient
             WHERE site_id=? AND channel=? AND is_enabled=TRUE
             ORDER BY priority,id
            """, (rs, row) -> new WebhookWindow(rs.getString("destination"),
                localTime(rs.getTime("quiet_start")), localTime(rs.getTime("quiet_end"))), siteId, CHANNEL);
        LinkedHashSet<String> result = new LinkedHashSet<>();
        rows.stream().filter(row -> !isQuiet(now, row.start(), row.end())).forEach(row -> result.add(row.destination()));
        return List.copyOf(result);
    }

    public boolean hasConfiguredWebhooks(String siteId) {
        Integer count = jdbcTemplate.queryForObject("""
            SELECT COUNT(*) FROM site_alert_recipient WHERE site_id=? AND channel=?
            """, Integer.class, siteId, CHANNEL);
        return count != null && count > 0;
    }

    private RecipientSummary recipient(CurrentUser actor, long id) {
        return recipients(actor).stream().filter(recipient -> recipient.id() == id).findFirst()
            .orElseThrow(() -> new NotFoundException("알림 수신자를 찾을 수 없습니다."));
    }

    private RecipientTarget target(long id) {
        RecipientTarget target = jdbcTemplate.query("SELECT site_id FROM site_alert_recipient WHERE id=?",
            rs -> rs.next() ? new RecipientTarget(rs.getString(1)) : null, id);
        if (target == null) throw new NotFoundException("알림 수신자를 찾을 수 없습니다.");
        return target;
    }

    private static String validateWebhook(String raw) {
        if (raw == null || raw.isBlank()) throw new BadRequestException("Slack Webhook URL을 입력해주세요.");
        String value = raw.trim();
        try {
            URI uri = new URI(value);
            String host = uri.getHost();
            if (!"https".equalsIgnoreCase(uri.getScheme()) || host == null ||
                !(host.equals("hooks.slack.com") || host.endsWith(".hooks.slack.com") || host.equals("hooks.slack-gov.com"))) {
                throw new BadRequestException("공식 Slack Webhook HTTPS 주소만 사용할 수 있습니다.");
            }
        } catch (URISyntaxException error) {
            throw new BadRequestException("올바른 Slack Webhook URL을 입력해주세요.");
        }
        if (value.length() > 500) throw new BadRequestException("Slack Webhook URL이 너무 깁니다.");
        return value;
    }

    private static void validateQuietHours(LocalTime start, LocalTime end) {
        if ((start == null) != (end == null)) throw new BadRequestException("조용한 시간의 시작과 종료를 모두 입력해주세요.");
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
    private void requireAdmin(CurrentUser actor) { if (!actor.isAdmin()) throw new ForbiddenException("관리자 권한이 필요합니다."); }

    private record RecipientTarget(String siteId) {}
    private record WebhookWindow(String destination, LocalTime start, LocalTime end) {}
    public record RecipientSummary(long id, String siteId, String siteName, long userId, String userName,
                                   String channel, String destinationMasked, LocalTime quietStart,
                                   LocalTime quietEnd, boolean enabled) {}
    public record CreateRecipient(String siteId, String destination, LocalTime quietStart,
                                  LocalTime quietEnd, boolean enabled) {}
    public record UpdateRecipient(LocalTime quietStart, LocalTime quietEnd, boolean enabled) {}
}
