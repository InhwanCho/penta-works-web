package com.pentaworks.monitoring.alert;

import com.pentaworks.monitoring.admin.AuditService;
import com.pentaworks.monitoring.auth.CurrentUserService;
import com.pentaworks.monitoring.auth.CurrentUserService.CurrentUser;
import com.pentaworks.monitoring.common.NotFoundException;
import java.sql.Timestamp;
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
                   r.min_value,r.max_value,e.message,e.delivery_status,e.occurred_at,
                   e.acknowledged_at,e.recovered_at
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
                instant(rs.getTimestamp("acknowledged_at")), instant(rs.getTimestamp("recovered_at"))),
            args.toArray());
    }

    @Transactional
    public Transition evaluate(SiteAlertSettings site, AlertThreshold threshold, Double value) {
        if (!threshold.active()) return null;
        jdbcTemplate.update("""
            INSERT INTO alert_rule
                (site_id,metric_key,rule_type,min_value,max_value,severity,is_enabled,created_at,updated_at)
            VALUES (?,?, 'RANGE', ?,?, 'WARNING', TRUE, CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6))
            ON DUPLICATE KEY UPDATE min_value=VALUES(min_value),max_value=VALUES(max_value),
                                    severity=VALUES(severity),is_enabled=TRUE,updated_at=CURRENT_TIMESTAMP(6)
            """, site.siteid(), threshold.key(), threshold.min(), threshold.max());
        long ruleId = jdbcTemplate.queryForObject("""
            SELECT id FROM alert_rule WHERE site_id=? AND metric_key=? AND rule_type='RANGE' FOR UPDATE
            """, Long.class, site.siteid(), threshold.key());
        OpenEvent open = openEvent(ruleId);
        String direction = direction(value, threshold.min(), threshold.max());
        if (direction == null) {
            if (open == null) return null;
            Instant now = Instant.now();
            jdbcTemplate.update("UPDATE alert_event SET recovered_at=? WHERE id=?", Timestamp.from(now), open.id());
            String message = site.name() + " · " + threshold.label() + " 값이 정상 범위로 복구되었습니다.";
            long eventId = insertEvent(ruleId, site.siteid(), "RECOVERY", value, message, now, now);
            return new Transition(eventId, site.siteid(), site.name(), threshold.key(), threshold.label(),
                threshold.unit(), "RECOVERY", value, threshold.min(), threshold.max(), message);
        }
        String eventType = direction.toUpperCase();
        if (open != null && eventType.equals(open.eventType())) return null;
        Instant now = Instant.now();
        if (open != null) jdbcTemplate.update("UPDATE alert_event SET recovered_at=? WHERE id=?", Timestamp.from(now), open.id());
        String message = site.name() + " · " + threshold.label() + " 값이 " +
            ("LOW".equals(eventType) ? "최소값보다 낮습니다." : "최대값보다 높습니다.");
        long eventId = insertEvent(ruleId, site.siteid(), eventType, value, message, now, null);
        return new Transition(eventId, site.siteid(), site.name(), threshold.key(), threshold.label(),
            threshold.unit(), eventType, value, threshold.min(), threshold.max(), message);
    }

    public void markDelivery(List<Long> eventIds, String status, String error) {
        for (Long eventId : eventIds) {
            jdbcTemplate.update("UPDATE alert_event SET delivery_status=?,delivery_error=? WHERE id=?",
                status, error, eventId);
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

    private OpenEvent openEvent(long ruleId) {
        return jdbcTemplate.query("""
            SELECT id,event_type FROM alert_event
             WHERE rule_id=? AND recovered_at IS NULL AND event_type IN ('LOW','HIGH')
             ORDER BY id DESC LIMIT 1 FOR UPDATE
            """, rs -> rs.next() ? new OpenEvent(rs.getLong("id"), rs.getString("event_type")) : null, ruleId);
    }

    private long insertEvent(long ruleId, String siteId, String eventType, Double value, String message,
                             Instant occurredAt, Instant recoveredAt) {
        jdbcTemplate.update("""
            INSERT INTO alert_event
                (rule_id,site_id,event_type,severity,measured_value,message,recipient_snapshot,
                 delivery_status,occurred_at,recovered_at,created_at)
            VALUES (?,? ,?,'WARNING',?,?,'{}','PENDING',?,?,CURRENT_TIMESTAMP(6))
            """, ruleId, siteId, eventType, value, message, Timestamp.from(occurredAt),
            recoveredAt == null ? null : Timestamp.from(recoveredAt));
        return jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Long.class);
    }

    private static String direction(Double value, Double min, Double max) {
        if (value == null) return null;
        if (min != null && value < min) return "low";
        if (max != null && value > max) return "high";
        return null;
    }

    private static Double number(Object value) { return value == null ? null : ((Number) value).doubleValue(); }
    private static Instant instant(Timestamp value) { return value == null ? null : value.toInstant(); }
    private record OpenEvent(long id, String eventType) {}
    public record Transition(long eventId, String siteId, String siteName, String metricKey, String metricLabel,
                             String unit, String eventType, Double value, Double min, Double max, String message) {}
}
