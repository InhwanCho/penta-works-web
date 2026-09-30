package com.pentaworks.monitoring.alert;

import com.pentaworks.monitoring.admin.AuditService;
import com.pentaworks.monitoring.auth.CurrentUserService;
import com.pentaworks.monitoring.auth.CurrentUserService.CurrentUser;
import com.pentaworks.monitoring.common.NotFoundException;
import com.pentaworks.monitoring.common.BadRequestException;
import com.pentaworks.monitoring.common.ForbiddenException;
import com.pentaworks.monitoring.dashboard.DashboardService;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AlertEventService {
    private final JdbcTemplate jdbcTemplate;
    private final CurrentUserService currentUsers;
    private final AuditService audit;

    public AlertEventService(JdbcTemplate jdbcTemplate, CurrentUserService currentUsers, AuditService audit) {
        this.jdbcTemplate = jdbcTemplate;
        this.currentUsers = currentUsers;
        this.audit = audit;
    }

    public List<AlertEventSummary> events(Set<String> allowedSiteIds, int requestedLimit) {
        if (allowedSiteIds.isEmpty()) return List.of();
        int limit = Math.min(Math.max(requestedLimit, 1), 500);
        String placeholders = String.join(",", Collections.nCopies(allowedSiteIds.size(), "?"));
        List<Object> args = new ArrayList<>(allowedSiteIds);
        args.add(limit);
        return jdbcTemplate.query("""
            SELECT e.id,e.site_id,s.name,r.metric_key,e.event_type,e.severity,e.measured_value,
                   e.threshold_min AS min_value,e.threshold_max AS max_value,
                   e.message,e.delivery_status,e.occurred_at,
                   e.acknowledged_at,e.recovered_at,e.last_notified_at,e.notification_count,
                   CASE WHEN e.delivery_batch_id IS NULL AND e.delivery_status='FAILED'
                        THEN '기존 전송에 실패했습니다. 수신 채널 설정을 확인해주세요.'
                        ELSE e.delivery_error END AS safe_delivery_error
              FROM alert_event e
              JOIN alert_rule r ON r.id=e.rule_id
              LEFT JOIN site s ON s.site=e.site_id
             WHERE e.site_id IN (%s)
             ORDER BY e.occurred_at DESC,e.id DESC LIMIT ?
            """.formatted(placeholders), (rs, row) -> new AlertEventSummary(
                rs.getLong("id"), rs.getString("site_id"), rs.getString("name"), rs.getString("metric_key"),
                rs.getString("event_type"), rs.getString("severity"), number(rs.getObject("measured_value")),
                number(rs.getObject("min_value")), number(rs.getObject("max_value")), rs.getString("message"),
                rs.getString("delivery_status"), instant(rs.getTimestamp("occurred_at")),
                instant(rs.getTimestamp("acknowledged_at")), instant(rs.getTimestamp("recovered_at")),
                rs.getString("safe_delivery_error"), instant(rs.getTimestamp("last_notified_at")), rs.getInt("notification_count")),
            args.toArray());
    }

    public void requireEventAccess(long eventId, Set<String> allowedSiteIds) {
        String siteId = jdbcTemplate.query("SELECT site_id FROM alert_event WHERE id=?",
            rs -> rs.next() ? rs.getString(1) : null, eventId);
        if (siteId == null || !allowedSiteIds.contains(siteId)) throw new NotFoundException("알림 이력을 찾을 수 없습니다.");
    }

    @Transactional
    public Transition evaluate(SiteAlertSettings site, AlertThreshold threshold, Double value) {
        if (!site.dashboardVisible() || !site.alertsEnabled() || !threshold.active() ||
            value == null || DashboardService.isUnmeasured(value)) return null;
        Double min = threshold.effectiveMin();
        Double max = threshold.effectiveMax();
        jdbcTemplate.update("""
            INSERT INTO alert_rule
                (site_id,metric_key,rule_type,min_value,max_value,severity,is_enabled,created_at,updated_at)
            VALUES (?,?, 'RANGE', ?,?, 'WARNING', TRUE, CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6))
            ON DUPLICATE KEY UPDATE min_value=VALUES(min_value),max_value=VALUES(max_value),
                                    severity=VALUES(severity),is_enabled=TRUE,updated_at=CURRENT_TIMESTAMP(6)
            """, site.siteid(), threshold.key(), min, max);
        long ruleId = jdbcTemplate.queryForObject("""
            SELECT id FROM alert_rule WHERE site_id=? AND metric_key=? AND rule_type='RANGE' FOR UPDATE
            """, Long.class, site.siteid(), threshold.key());
        OpenEvent open = openEvent(ruleId);
        String direction = direction(value, min, max);
        if (direction == null) {
            clearPending(ruleId);
            if (open == null) return null;
            Instant now = Instant.now();
            jdbcTemplate.update("UPDATE alert_event SET recovered_at=? WHERE id=?", Timestamp.from(now), open.id());
            String message = site.name() + " · " + threshold.label() + " 값이 정상 범위로 복구되었습니다.";
            long eventId = insertEvent(ruleId, site.siteid(), "RECOVERY", value, message, now, now);
            return new Transition(eventId, site.siteid(), site.name(), threshold.key(), threshold.label(),
                threshold.unit(), "RECOVERY", value, min, max, message);
        }
        String eventType = direction.toUpperCase();
        if (open != null && eventType.equals(open.eventType())) {
            if (!repeatDue(open, site.repeatMinutes())) return null;
            String message = site.name() + " · " + threshold.label() + " 값이 계속 " +
                ("LOW".equals(eventType) ? "최소값보다 낮습니다." : "최대값보다 높습니다.");
            return new Transition(open.id(), site.siteid(), site.name(), threshold.key(), threshold.label(),
                threshold.unit(), eventType, value, min, max, message);
        }
        Instant now = Instant.now();
        if (open != null) {
            jdbcTemplate.update("UPDATE alert_event SET recovered_at=? WHERE id=?", Timestamp.from(now), open.id());
            clearPending(ruleId);
        }
        if (!sustained(ruleId, eventType, site.triggerAfterMinutes(), now)) return null;
        clearPending(ruleId);
        String message = site.name() + " · " + threshold.label() + " 값이 " +
            ("LOW".equals(eventType) ? "최소값보다 낮습니다." : "최대값보다 높습니다.");
        long eventId = insertEvent(ruleId, site.siteid(), eventType, value, message, now, null);
        return new Transition(eventId, site.siteid(), site.name(), threshold.key(), threshold.label(),
            threshold.unit(), eventType, value, min, max, message);
    }

    @Transactional
    public Transition evaluateNoData(SiteAlertSettings site, Long lagMinutes) {
        if (!site.dashboardVisible()) return null;
        if (!site.alertsEnabled() || !site.noDataActive()) return null;
        jdbcTemplate.update("""
            INSERT INTO alert_rule
                (site_id,metric_key,rule_type,no_data_minutes,severity,is_enabled,created_at,updated_at)
            VALUES (?,'__data__','NO_DATA',?,'WARNING',TRUE,CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6))
            ON DUPLICATE KEY UPDATE no_data_minutes=VALUES(no_data_minutes),severity=VALUES(severity),
                                    is_enabled=TRUE,updated_at=CURRENT_TIMESTAMP(6)
            """, site.siteid(), site.noDataMinutes());
        long ruleId = jdbcTemplate.queryForObject("""
            SELECT id FROM alert_rule WHERE site_id=? AND metric_key='__data__' AND rule_type='NO_DATA' FOR UPDATE
            """, Long.class, site.siteid());
        OpenEvent open = openEvent(ruleId, "NO_DATA");
        boolean stale = lagMinutes == null || lagMinutes > site.noDataMinutes();
        Double measured = lagMinutes == null ? null : lagMinutes.doubleValue();
        if (!stale) {
            clearPending(ruleId);
            if (open == null) return null;
            Instant now = Instant.now();
            jdbcTemplate.update("UPDATE alert_event SET recovered_at=? WHERE id=?", Timestamp.from(now), open.id());
            String message = site.name() + " · 데이터 수신이 정상화되었습니다.";
            long eventId = insertEvent(ruleId, site.siteid(), "RECOVERY", measured, message, now, now);
            return new Transition(eventId, site.siteid(), site.name(), "__data__", "데이터 수신", "분",
                "RECOVERY", measured, null, (double) site.noDataMinutes(), message);
        }
        if (open != null) {
            if (!repeatDue(open, site.repeatMinutes())) return null;
            String message = lagMinutes == null
                ? site.name() + " · 수신된 데이터가 계속 없습니다."
                : site.name() + " · 마지막 데이터 수신 후 " + lagMinutes + "분이 지났습니다.";
            return new Transition(open.id(), site.siteid(), site.name(), "__data__", "데이터 수신", "분",
                "NO_DATA", measured, null, (double) site.noDataMinutes(), message);
        }
        Instant now = Instant.now();
        String message = lagMinutes == null
            ? site.name() + " · 수신된 데이터가 없습니다."
            : site.name() + " · 마지막 데이터 수신 후 " + lagMinutes + "분이 지났습니다.";
        long eventId = insertEvent(ruleId, site.siteid(), "NO_DATA", measured, message, now, null);
        return new Transition(eventId, site.siteid(), site.name(), "__data__", "데이터 수신", "분",
            "NO_DATA", measured, null, (double) site.noDataMinutes(), message);
    }

    public void markDelivery(List<Long> eventIds, String status, String error) {
        markDelivery(eventIds, status, error, 0);
    }

    public void markDelivery(List<Long> eventIds, String status, String error, int recipientCount) {
        String snapshot = "{\"channel\":\"KAKAO_ALIMTALK\",\"count\":" + recipientCount + "}";
        for (Long eventId : eventIds) {
            jdbcTemplate.update("""
                UPDATE alert_event
                   SET delivery_status=?,delivery_error=?,recipient_snapshot=?,
                       delivery_batch_id=NULL,delivery_started_at=NULL,
                       last_notified_at=CURRENT_TIMESTAMP(6),
                       notification_count=notification_count+CASE WHEN ?='SKIPPED' THEN 0 ELSE 1 END
                 WHERE id=? AND delivery_status<>'SENDING'
                """, status, error, snapshot, status, eventId);
        }
    }

    @Transactional
    public AlertEventSummary acknowledge(CurrentUser actor, long eventId) {
        String siteId = jdbcTemplate.query("SELECT site_id FROM alert_event WHERE id=?",
            rs -> rs.next() ? rs.getString(1) : null, eventId);
        if (siteId == null) throw new NotFoundException("알림 이력을 찾을 수 없습니다.");
        currentUsers.requireSiteAccess(actor, siteId);
        jdbcTemplate.update("""
            UPDATE alert_event SET acknowledged_by=?,acknowledged_at=COALESCE(acknowledged_at,CURRENT_TIMESTAMP(6))
             WHERE id=?
            """, actor.id(), eventId);
        audit.record(actor, "ALERT_ACKNOWLEDGED", "ALERT_EVENT", Long.toString(eventId),
            java.util.Map.of("siteId", siteId));
        return events(Set.of(siteId), 500).stream().filter(event -> event.id() == eventId)
            .findFirst().orElseThrow(() -> new NotFoundException("알림 이력을 찾을 수 없습니다."));
    }

    @Transactional
    public int acknowledgeMany(CurrentUser actor, List<Long> eventIds) {
        if (eventIds == null || eventIds.isEmpty()) throw new BadRequestException("확인할 알림을 선택해주세요.");
        if (eventIds.size() > 500) throw new BadRequestException("한 번에 최대 500건까지 확인할 수 있습니다.");
        int updated = 0;
        for (Long eventId : new java.util.LinkedHashSet<>(eventIds)) {
            AlertEventSummary event = acknowledge(actor, eventId);
            if (event.acknowledgedAt() != null) updated++;
        }
        return updated;
    }

    public Transition retryTransition(CurrentUser actor, long eventId) {
        if (!actor.isAdmin()) throw new ForbiddenException("관리자 권한이 필요합니다.");
        RetryEvent event = jdbcTemplate.query("""
            SELECT e.id,e.site_id,s.name,r.metric_key,e.event_type,e.measured_value,
                   e.threshold_min AS min_value,e.threshold_max AS max_value,e.message,e.delivery_status
              FROM alert_event e
              JOIN alert_rule r ON r.id=e.rule_id
              LEFT JOIN site s ON s.site=e.site_id
             WHERE e.id=?
            """, rs -> rs.next() ? new RetryEvent(rs.getLong("id"), rs.getString("site_id"),
                rs.getString("name"), rs.getString("metric_key"), rs.getString("event_type"),
                number(rs.getObject("measured_value")), number(rs.getObject("min_value")),
                number(rs.getObject("max_value")), rs.getString("message"), rs.getString("delivery_status")) : null,
            eventId);
        if (event == null) throw new NotFoundException("알림 이력을 찾을 수 없습니다.");
        currentUsers.requireSiteAccess(actor, event.siteId());
        currentUsers.requireVisibleSiteAccess(actor, event.siteId());
        if (!List.of("FAILED", "PARTIAL", "SKIPPED").contains(event.deliveryStatus()))
            throw new BadRequestException("미발송 또는 전송에 실패한 알림만 재전송할 수 있습니다.");
        return new Transition(event.id(), event.siteId(), event.siteName(), event.metricKey(),
            event.metricKey(), null, event.eventType(), event.value(), event.min(), event.max(), event.message());
    }

    @Transactional
    public void disableRule(String siteId, String metricKey) {
        jdbcTemplate.update("""
            UPDATE alert_rule SET is_enabled=FALSE,updated_at=CURRENT_TIMESTAMP(6)
             WHERE site_id=? AND metric_key=? AND rule_type='RANGE' AND is_enabled=TRUE
            """, siteId, metricKey);
        jdbcTemplate.update("""
            UPDATE alert_event e JOIN alert_rule r ON r.id=e.rule_id
               SET e.recovered_at=CURRENT_TIMESTAMP(6)
             WHERE r.site_id=? AND r.metric_key=? AND r.rule_type='RANGE'
               AND e.recovered_at IS NULL AND e.event_type IN ('LOW','HIGH')
            """, siteId, metricKey);
    }

    @Transactional
    public void disableNoDataRule(String siteId) {
        jdbcTemplate.update("""
            UPDATE alert_rule SET is_enabled=FALSE,updated_at=CURRENT_TIMESTAMP(6)
             WHERE site_id=? AND metric_key='__data__' AND rule_type='NO_DATA' AND is_enabled=TRUE
            """, siteId);
        jdbcTemplate.update("""
            UPDATE alert_event e JOIN alert_rule r ON r.id=e.rule_id
               SET e.recovered_at=CURRENT_TIMESTAMP(6)
             WHERE r.site_id=? AND r.metric_key='__data__' AND r.rule_type='NO_DATA'
               AND e.recovered_at IS NULL AND e.event_type='NO_DATA'
            """, siteId);
    }

    @Transactional
    public void disableSite(String siteId) {
        jdbcTemplate.update("DELETE p FROM alert_pending_state p JOIN alert_rule r ON r.id=p.rule_id WHERE r.site_id=?", siteId);
        jdbcTemplate.update("""
            UPDATE alert_event e JOIN alert_rule r ON r.id=e.rule_id
               SET e.recovered_at=CURRENT_TIMESTAMP(6)
             WHERE r.site_id=? AND e.recovered_at IS NULL AND e.event_type IN ('LOW','HIGH','NO_DATA')
            """, siteId);
    }

    private OpenEvent openEvent(long ruleId) {
        return openEvent(ruleId, "LOW", "HIGH");
    }

    private OpenEvent openEvent(long ruleId, String... eventTypes) {
        String placeholders = String.join(",", Collections.nCopies(eventTypes.length, "?"));
        List<Object> args = new ArrayList<>();
        args.add(ruleId);
        args.addAll(List.of(eventTypes));
        return jdbcTemplate.query("""
            SELECT id,event_type,occurred_at,last_notified_at FROM alert_event
             WHERE rule_id=? AND recovered_at IS NULL AND event_type IN (%s)
             ORDER BY id DESC LIMIT 1 FOR UPDATE
            """.formatted(placeholders),
            rs -> rs.next() ? new OpenEvent(rs.getLong("id"), rs.getString("event_type"),
                instant(rs.getTimestamp("occurred_at")), instant(rs.getTimestamp("last_notified_at"))) : null,
            args.toArray());
    }

    private boolean sustained(long ruleId, String eventType, int minutes, Instant now) {
        if (minutes <= 0) return true;
        PendingState pending = jdbcTemplate.query("""
            SELECT event_type,first_seen_at FROM alert_pending_state WHERE rule_id=? FOR UPDATE
            """, rs -> rs.next() ? new PendingState(rs.getString("event_type"),
                instant(rs.getTimestamp("first_seen_at"))) : null, ruleId);
        if (pending == null || !eventType.equals(pending.eventType())) {
            jdbcTemplate.update("""
                INSERT INTO alert_pending_state (rule_id,event_type,first_seen_at,last_seen_at)
                VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE event_type=VALUES(event_type),
                    first_seen_at=VALUES(first_seen_at),last_seen_at=VALUES(last_seen_at)
                """, ruleId, eventType, Timestamp.from(now), Timestamp.from(now));
            return false;
        }
        jdbcTemplate.update("UPDATE alert_pending_state SET last_seen_at=? WHERE rule_id=?", Timestamp.from(now), ruleId);
        return pending.firstSeenAt() != null && Duration.between(pending.firstSeenAt(), now).toMinutes() >= minutes;
    }

    private boolean repeatDue(OpenEvent open, int repeatMinutes) {
        if (repeatMinutes <= 0 || open.lastNotifiedAt() == null) return false;
        return Duration.between(open.lastNotifiedAt(), Instant.now()).toMinutes() >= repeatMinutes;
    }

    private void clearPending(long ruleId) {
        jdbcTemplate.update("DELETE FROM alert_pending_state WHERE rule_id=?", ruleId);
    }

    private long insertEvent(long ruleId, String siteId, String eventType, Double value, String message,
                             Instant occurredAt, Instant recoveredAt) {
        jdbcTemplate.update("""
            INSERT INTO alert_event
                (rule_id,site_id,event_type,severity,measured_value,message,recipient_snapshot,
                 delivery_status,occurred_at,recovered_at,created_at,threshold_min,threshold_max)
            SELECT ?,? ,?,'WARNING',?,?,'{}','PENDING',?,?,CURRENT_TIMESTAMP(6),
                   min_value,COALESCE(max_value,no_data_minutes) FROM alert_rule WHERE id=?
            """, ruleId, siteId, eventType, value, message, Timestamp.from(occurredAt),
            recoveredAt == null ? null : Timestamp.from(recoveredAt), ruleId);
        return jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Long.class);
    }

    static String direction(Double value, Double min, Double max) {
        if (value == null) return null;
        if (DashboardService.isUnmeasured(value)) return null;
        if (min != null && value < min) return "low";
        if (max != null && value > max) return "high";
        return null;
    }

    private static Double number(Object value) { return value == null ? null : ((Number) value).doubleValue(); }
    private static Instant instant(Timestamp value) { return value == null ? null : value.toInstant(); }
    private record OpenEvent(long id, String eventType, Instant occurredAt, Instant lastNotifiedAt) {}
    private record PendingState(String eventType, Instant firstSeenAt) {}
    private record RetryEvent(long id, String siteId, String siteName, String metricKey, String eventType,
                              Double value, Double min, Double max, String message, String deliveryStatus) {}
    public record Transition(long eventId, String siteId, String siteName, String metricKey, String metricLabel,
                             String unit, String eventType, Double value, Double min, Double max, String message) {}
}
