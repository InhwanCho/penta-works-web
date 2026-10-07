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

    public List<AlertEventSummary> events(Set<String> allowedSiteIds, int requestedLimit, long actorId) {
        return events(allowedSiteIds, requestedLimit, actorId, null);
    }

    private List<AlertEventSummary> events(Set<String> allowedSiteIds, int requestedLimit, long actorId, Long eventId) {
        if (allowedSiteIds.isEmpty()) return List.of();
        int limit = Math.min(Math.max(requestedLimit, 1), 500);
        String placeholders = String.join(",", Collections.nCopies(allowedSiteIds.size(), "?"));
        List<Object> args = new ArrayList<>();
        args.add(actorId);
        args.addAll(allowedSiteIds);
        args.add(actorId);
        if (eventId != null) args.add(eventId);
        args.add(limit);
        return jdbcTemplate.query("""
            SELECT e.id,e.site_id,s.name,r.metric_key,e.event_type,e.severity,e.measured_value,
                   e.threshold_min AS min_value,e.threshold_max AS max_value,
                   e.message,e.delivery_status,e.occurred_at,
                   ack.acknowledged_at,e.recovered_at,e.last_notified_at,e.notification_count,
                   CASE WHEN e.delivery_batch_id IS NULL AND e.delivery_status='FAILED'
                        THEN '기존 전송에 실패했습니다. 수신 채널 설정을 확인해주세요.'
                        ELSE e.delivery_error END AS safe_delivery_error
              FROM alert_event e
              JOIN alert_rule r ON r.id=e.rule_id
              LEFT JOIN site s ON s.site=e.site_id
              LEFT JOIN alert_event_acknowledgement ack ON ack.event_id=e.id AND ack.user_id=?
             WHERE e.event_type<>'RECOVERY' AND e.site_id IN (%s) AND r.user_id=?
               AND EXISTS (SELECT 1 FROM site_alert_recipient recipient
                            WHERE recipient.site_id=e.site_id AND recipient.user_id=r.user_id
                              AND recipient.is_enabled=TRUE) %s
             ORDER BY e.occurred_at DESC,e.id DESC LIMIT ?
            """.formatted(placeholders, eventId == null ? "" : "AND e.id=?"), (rs, row) -> new AlertEventSummary(
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

    public void requireEventAccess(long eventId, CurrentUser actor) {
        requireEventAccess(eventId,currentUsers.allowedSiteIds(actor));
        Long owner=jdbcTemplate.query("""
            SELECT r.user_id FROM alert_event e JOIN alert_rule r ON r.id=e.rule_id
             WHERE e.id=? AND r.user_id=?
               AND EXISTS (SELECT 1 FROM site_alert_recipient recipient
                            WHERE recipient.site_id=e.site_id AND recipient.user_id=r.user_id
                              AND recipient.is_enabled=TRUE)
            """, rs->rs.next()?rs.getLong(1):null,eventId,actor.id());
        if(owner==null || owner!=actor.id()) throw new NotFoundException("알림 이력을 찾을 수 없습니다.");
    }

    public long owner(long eventId) {
        Long owner=jdbcTemplate.query("SELECT r.user_id FROM alert_event e JOIN alert_rule r ON r.id=e.rule_id WHERE e.id=?",rs->rs.next()?rs.getLong(1):null,eventId);
        if(owner==null)throw new NotFoundException("알림 이력을 찾을 수 없습니다.");
        return owner;
    }

    @Transactional
    public Transition evaluate(SiteAlertSettings site, AlertThreshold threshold, Double value) {
        return evaluate(0, site, threshold, value);
    }

    @Transactional
    public Transition evaluate(long userId, SiteAlertSettings site, AlertThreshold threshold, Double value) {
        return evaluateCondition(userId, site, threshold, value, false, null);
    }

    @Transactional
    public Transition evaluateColdChiller(SiteAlertSettings site, Double inlet, Double outlet) {
        return evaluateColdChiller(0,site,inlet,outlet);
    }

    @Transactional
    public Transition evaluateColdChiller(long userId, SiteAlertSettings site, Double inlet, Double outlet) {
        if (!site.coldChillerActive() || inlet == null || outlet == null ||
            !Double.isFinite(inlet) || !Double.isFinite(outlet) ||
            DashboardService.isUnmeasured(inlet) || DashboardService.isUnmeasured(outlet)) return null;
        return evaluateCondition(userId, site,
            new AlertThreshold("__cold_chiller__", "콜드칠러 정지 의심 (IN=OUT)", "°C", null, null, true),
            inlet, true, Double.compare(inlet, outlet) == 0 ? "HIGH" : null);
    }

    private Transition evaluateCondition(long userId, SiteAlertSettings site, AlertThreshold threshold, Double value,
                                         boolean coldChiller, String conditionDirection) {
        if (!site.dashboardVisible() || !site.alertsEnabled() || !threshold.active() ||
            value == null || DashboardService.isUnmeasured(value)) return null;
        Double min = threshold.effectiveMin();
        Double max = threshold.effectiveMax();
        jdbcTemplate.update("""
            INSERT INTO alert_rule
                (user_id,site_id,metric_key,rule_type,min_value,max_value,severity,is_enabled,created_at,updated_at)
            VALUES (?,?,?, 'RANGE', ?,?, 'WARNING', TRUE, CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6))
            ON DUPLICATE KEY UPDATE min_value=VALUES(min_value),max_value=VALUES(max_value),
                                    severity=VALUES(severity),is_enabled=TRUE,updated_at=CURRENT_TIMESTAMP(6)
            """, userId, site.siteid(), threshold.key(), min, max);
        long ruleId = jdbcTemplate.queryForObject("""
            SELECT id FROM alert_rule WHERE user_id=? AND site_id=? AND metric_key=? AND rule_type='RANGE' FOR UPDATE
            """, Long.class, userId, site.siteid(), threshold.key());
        OpenEvent open = openEvent(ruleId);
        String direction = coldChiller ? conditionDirection : direction(value, min, max);
        if (direction == null) {
            clearPending(ruleId);
            if (open == null) return null;
            Instant now = Instant.now();
            jdbcTemplate.update("UPDATE alert_event SET recovered_at=? WHERE id=?", Timestamp.from(now), open.id());
            return null;
        }
        String eventType = direction.toUpperCase();
        if (open != null) {
            if (!repeatDue(open, site.repeatMinutes())) return null;
            String message = site.name() + " · " + threshold.label() + " 값이 계속 " +
                ("LOW".equals(eventType) ? "최소값보다 낮습니다." : "최대값보다 높습니다.");
            if (coldChiller) message = site.name() + " · 콜드칠러 IN/OUT 온도가 " + value + "°C로 동일합니다. 정지 상태를 확인해주세요.";
            jdbcTemplate.update("UPDATE alert_event SET event_type=?,measured_value=?,threshold_min=?,threshold_max=?,message=? WHERE id=?",
                eventType, value, min, max, message, open.id());
            return new Transition(open.id(), site.siteid(), site.name(), threshold.key(), threshold.label(),
                threshold.unit(), eventType, value, min, max, message);
        }
        Instant now = Instant.now();
        if (!sustained(ruleId, eventType, site.triggerAfterMinutes(), now)) return null;
        clearPending(ruleId);
        String message = site.name() + " · " + threshold.label() + " 값이 " +
            ("LOW".equals(eventType) ? "최소값보다 낮습니다." : "최대값보다 높습니다.");
        if (coldChiller) message = site.name() + " · 콜드칠러 IN/OUT 온도가 " + value + "°C로 동일합니다. 정지 상태를 확인해주세요.";
        long eventId = insertEvent(ruleId, site.siteid(), eventType, value, message, now, null);
        return new Transition(eventId, site.siteid(), site.name(), threshold.key(), threshold.label(),
            threshold.unit(), eventType, value, min, max, message);
    }

    @Transactional
    public Transition evaluateNoData(SiteAlertSettings site, Long lagMinutes) {
        return evaluateNoData(0,site,lagMinutes);
    }

    @Transactional
    public Transition evaluateNoData(long userId, SiteAlertSettings site, Long lagMinutes) {
        if (!site.dashboardVisible()) return null;
        if (!site.alertsEnabled() || !site.noDataActive()) return null;
        jdbcTemplate.update("""
            INSERT INTO alert_rule
                (user_id,site_id,metric_key,rule_type,no_data_minutes,severity,is_enabled,created_at,updated_at)
            VALUES (?,?,'__data__','NO_DATA',?,'WARNING',TRUE,CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6))
            ON DUPLICATE KEY UPDATE no_data_minutes=VALUES(no_data_minutes),severity=VALUES(severity),
                                    is_enabled=TRUE,updated_at=CURRENT_TIMESTAMP(6)
            """, userId, site.siteid(), site.noDataMinutes());
        long ruleId = jdbcTemplate.queryForObject("""
            SELECT id FROM alert_rule WHERE user_id=? AND site_id=? AND metric_key='__data__' AND rule_type='NO_DATA' FOR UPDATE
            """, Long.class, userId, site.siteid());
        OpenEvent open = openEvent(ruleId, "NO_DATA");
        boolean stale = CollectionHealth.isMissing(lagMinutes, site.collectionIntervalMinutes(), site.missingCollectionThreshold());
        Long missedCount = CollectionHealth.missedCount(lagMinutes, site.collectionIntervalMinutes());
        Double measured = lagMinutes == null ? null : lagMinutes.doubleValue();
        if (!stale) {
            clearPending(ruleId);
            if (open == null) return null;
            Instant now = Instant.now();
            jdbcTemplate.update("UPDATE alert_event SET recovered_at=? WHERE id=?", Timestamp.from(now), open.id());
            return null;
        }
        if (open != null) {
            if (!repeatDue(open, site.repeatMinutes())) return null;
            String message = lagMinutes == null
                ? site.name() + " · 수신된 데이터가 계속 없습니다."
                : site.name() + " · 수집 " + missedCount + "회 연속 누락 (" + site.collectionIntervalMinutes() + "분 주기, 마지막 수신 " + lagMinutes + "분 전)";
            jdbcTemplate.update("UPDATE alert_event SET measured_value=?,threshold_max=?,message=? WHERE id=?", measured, site.noDataMinutes(), message, open.id());
            return new Transition(open.id(), site.siteid(), site.name(), "__data__", missedCount == null ? "데이터 수집 기록 없음" : "데이터 수집 " + missedCount + "회 연속 누락", "분",
                "NO_DATA", measured, null, (double) site.noDataMinutes(), message);
        }
        Instant now = Instant.now();
        String message = lagMinutes == null
            ? site.name() + " · 수신된 데이터가 없습니다."
            : site.name() + " · 수집 " + missedCount + "회 연속 누락 (" + site.collectionIntervalMinutes() + "분 주기, 마지막 수신 " + lagMinutes + "분 전)";
        long eventId = insertEvent(ruleId, site.siteid(), "NO_DATA", measured, message, now, null);
        return new Transition(eventId, site.siteid(), site.name(), "__data__", missedCount == null ? "데이터 수집 기록 없음" : "데이터 수집 " + missedCount + "회 연속 누락", "분",
            "NO_DATA", measured, null, (double) site.noDataMinutes(), message);
    }

    @Transactional
    public Transition evaluateMetricMissing(long userId, SiteAlertSettings site, AlertThreshold threshold, int count) {
        if(count<0 || !site.dashboardVisible() || !site.alertsEnabled() || !threshold.missingActive()) return null;
        jdbcTemplate.update("""
            INSERT INTO alert_rule(user_id,site_id,metric_key,rule_type,max_value,severity,is_enabled,created_at,updated_at)
            VALUES(?,?,?,'METRIC_MISSING',?,'WARNING',TRUE,CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6))
            ON DUPLICATE KEY UPDATE max_value=VALUES(max_value),is_enabled=TRUE,updated_at=CURRENT_TIMESTAMP(6)
            """,userId,site.siteid(),threshold.key(),threshold.missingThreshold());
        long ruleId=jdbcTemplate.queryForObject("SELECT id FROM alert_rule WHERE user_id=? AND site_id=? AND metric_key=? AND rule_type='METRIC_MISSING' FOR UPDATE",Long.class,userId,site.siteid(),threshold.key());
        OpenEvent open=openEvent(ruleId,"METRIC_MISSING");
        if(count<threshold.missingThreshold()) {
            if(open!=null)jdbcTemplate.update("UPDATE alert_event SET recovered_at=? WHERE id=?",Timestamp.from(Instant.now()),open.id());
            return null;
        }
        String message=site.name()+" · "+threshold.label()+" 측정값이 "+count+"회 연속 누락되었습니다. 측정 연결 상태를 확인해주세요.";
        long eventId;
        if(open!=null) {
            jdbcTemplate.update("UPDATE alert_event SET measured_value=?,threshold_max=?,message=? WHERE id=?",count,threshold.missingThreshold(),message,open.id());
            if(!repeatDue(open,site.repeatMinutes()))return null;
            eventId=open.id();
        } else eventId=insertEvent(ruleId,site.siteid(),"METRIC_MISSING",(double)count,message,Instant.now(),null);
        return new Transition(eventId,site.siteid(),site.name(),threshold.key(),threshold.label()+" 측정 누락","회","METRIC_MISSING",(double)count,null,(double)threshold.missingThreshold(),message);
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
                       last_notified_at=CASE WHEN ?='SKIPPED' THEN last_notified_at ELSE CURRENT_TIMESTAMP(6) END,
                       notification_count=notification_count+CASE WHEN ?='SKIPPED' THEN 0 ELSE 1 END
                 WHERE id=? AND delivery_status NOT IN ('SENDING','UNKNOWN')
                """, status, error, snapshot, status, status, eventId);
        }
    }

    @Transactional
    public AlertEventSummary acknowledge(CurrentUser actor, long eventId) {
        requireEventAccess(eventId,actor);
        String siteId = jdbcTemplate.query("SELECT site_id FROM alert_event WHERE id=?",
            rs -> rs.next() ? rs.getString(1) : null, eventId);
        if (siteId == null) throw new NotFoundException("알림 이력을 찾을 수 없습니다.");
        currentUsers.requireSiteAccess(actor, siteId);
        jdbcTemplate.update("""
            INSERT IGNORE INTO alert_event_acknowledgement (user_id,event_id) VALUES (?,?)
            """, actor.id(), eventId);
        audit.record(actor, "ALERT_ACKNOWLEDGED", "ALERT_EVENT", Long.toString(eventId),
            java.util.Map.of("siteId", siteId));
        return events(Set.of(siteId), 1, actor.id(), eventId).stream()
            .findFirst().orElseThrow(() -> new NotFoundException("알림 이력을 찾을 수 없습니다."));
    }

    @Transactional
    public int acknowledgeMany(CurrentUser actor, List<Long> eventIds) {
        if (eventIds == null || eventIds.isEmpty()) throw new BadRequestException("확인할 알림을 선택해주세요.");
        if (eventIds.size() > 500 || eventIds.stream().anyMatch(java.util.Objects::isNull))
            throw new BadRequestException("확인할 알림은 최대 500건까지 올바른 번호로 지정해주세요.");
        int updated = 0;
        for (Long eventId : new java.util.LinkedHashSet<>(eventIds)) {
            AlertEventSummary event = acknowledge(actor, eventId);
            if (event.acknowledgedAt() != null) updated++;
        }
        return updated;
    }

    public Transition retryTransition(CurrentUser actor, long eventId) {
        requireEventAccess(eventId,actor);
        RetryEvent event = jdbcTemplate.query("""
            SELECT e.id,e.site_id,s.name,r.metric_key,e.event_type,e.measured_value,
                   e.threshold_min AS min_value,e.threshold_max AS max_value,e.message,e.delivery_status
              FROM alert_event e
              JOIN alert_rule r ON r.id=e.rule_id
              LEFT JOIN site s ON s.site=e.site_id
             WHERE e.id=? AND e.recovered_at IS NULL AND r.is_enabled=TRUE
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
        if (!"__data__".equals(event.metricKey()) && DashboardService.isUnmeasured(event.value()))
            throw new BadRequestException("미측정 값으로 발생한 알림은 재전송할 수 없습니다.");
        return new Transition(event.id(), event.siteId(), event.siteName(), event.metricKey(),
            "METRIC_MISSING".equals(event.eventType()) ? event.metricKey()+" 측정 누락" : "__cold_chiller__".equals(event.metricKey()) ? "콜드칠러 정지 의심 (IN=OUT)" : event.metricKey(),
            "METRIC_MISSING".equals(event.eventType()) ? "회" : "__cold_chiller__".equals(event.metricKey()) ? "°C" : null,
            event.eventType(), event.value(), event.min(), event.max(), event.message());
    }

    @Transactional
    public void disableRule(String siteId, String metricKey) {
        jdbcTemplate.update("""
            UPDATE alert_rule SET is_enabled=FALSE,updated_at=CURRENT_TIMESTAMP(6)
             WHERE user_id=0 AND site_id=? AND metric_key=? AND rule_type='RANGE' AND is_enabled=TRUE
            """, siteId, metricKey);
        jdbcTemplate.update("""
            UPDATE alert_event e JOIN alert_rule r ON r.id=e.rule_id
               SET e.recovered_at=CURRENT_TIMESTAMP(6)
             WHERE r.user_id=0 AND r.site_id=? AND r.metric_key=? AND r.rule_type='RANGE'
               AND e.recovered_at IS NULL AND e.event_type IN ('LOW','HIGH')
            """, siteId, metricKey);
    }

    @Transactional
    public void disableNoDataRule(String siteId) {
        jdbcTemplate.update("""
            UPDATE alert_rule SET is_enabled=FALSE,updated_at=CURRENT_TIMESTAMP(6)
             WHERE user_id=0 AND site_id=? AND metric_key='__data__' AND rule_type='NO_DATA' AND is_enabled=TRUE
            """, siteId);
        jdbcTemplate.update("""
            UPDATE alert_event e JOIN alert_rule r ON r.id=e.rule_id
               SET e.recovered_at=CURRENT_TIMESTAMP(6)
             WHERE r.user_id=0 AND r.site_id=? AND r.metric_key='__data__' AND r.rule_type='NO_DATA'
               AND e.recovered_at IS NULL AND e.event_type='NO_DATA'
            """, siteId);
    }

    @Transactional
    public void disableSite(String siteId) {
        jdbcTemplate.update("DELETE p FROM alert_pending_state p JOIN alert_rule r ON r.id=p.rule_id WHERE r.site_id=?", siteId);
        jdbcTemplate.update("""
            UPDATE alert_event e JOIN alert_rule r ON r.id=e.rule_id
               SET e.recovered_at=CURRENT_TIMESTAMP(6)
             WHERE r.site_id=? AND e.recovered_at IS NULL AND e.event_type IN ('LOW','HIGH','NO_DATA','METRIC_MISSING')
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
            SELECT id,event_type,occurred_at,last_notified_at,delivery_status FROM alert_event
             WHERE rule_id=? AND recovered_at IS NULL AND event_type IN (%s)
             ORDER BY id DESC LIMIT 1 FOR UPDATE
            """.formatted(placeholders),
            rs -> rs.next() ? new OpenEvent(rs.getLong("id"), rs.getString("event_type"),
                instant(rs.getTimestamp("occurred_at")), instant(rs.getTimestamp("last_notified_at")), rs.getString("delivery_status")) : null,
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
        if ("UNKNOWN".equals(open.deliveryStatus()) || "SENDING".equals(open.deliveryStatus())) return false;
        // A quiet-hours/no-recipient skip is not a notification, including one-shot rules.
        if ("SKIPPED".equals(open.deliveryStatus())) return true;
        if (repeatMinutes <= 0) return false;
        if (open.lastNotifiedAt() == null) return true;
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
    private record OpenEvent(long id, String eventType, Instant occurredAt, Instant lastNotifiedAt, String deliveryStatus) {}
    private record PendingState(String eventType, Instant firstSeenAt) {}
    private record RetryEvent(long id, String siteId, String siteName, String metricKey, String eventType,
                              Double value, Double min, Double max, String message, String deliveryStatus) {}
    public record Transition(long eventId, String siteId, String siteName, String metricKey, String metricLabel,
                             String unit, String eventType, Double value, Double min, Double max, String message) {}
}
