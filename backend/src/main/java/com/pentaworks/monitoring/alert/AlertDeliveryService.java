package com.pentaworks.monitoring.alert;

import com.pentaworks.monitoring.auth.SecureTokens;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AlertDeliveryService {
    private final JdbcTemplate jdbc;
    private final SecureTokens tokens;
    private final com.pentaworks.monitoring.admin.AuditService audit;
    public AlertDeliveryService(JdbcTemplate jdbc, SecureTokens tokens, com.pentaworks.monitoring.admin.AuditService audit) {
        this.jdbc = jdbc; this.tokens = tokens; this.audit = audit;
    }

    @Transactional
    public Batch begin(long eventId, List<String> destinations, boolean retry) {
        Event event = jdbc.query("SELECT delivery_status,delivery_batch_id,last_notified_at FROM alert_event WHERE id=? FOR UPDATE",
            rs -> rs.next() ? new Event(rs.getString(1), rs.getString(2), rs.getTimestamp(3) == null ? null : rs.getTimestamp(3).toInstant()) : null, eventId);
        if (event == null || "SENDING".equals(event.status())) return null;
        if (!retry && event.lastNotifiedAt() != null && event.lastNotifiedAt().plusSeconds(60).isAfter(Instant.now())) return null;
        if (retry && !List.of("FAILED", "PARTIAL", "SKIPPED").contains(event.status())) return null;
        List<String> priorKeys = retry && event.batchId() != null ? jdbc.query("""
            SELECT recipient_key FROM alert_delivery_result
             WHERE event_id=? AND batch_id=? AND channel='KAKAO_ALIMTALK'
            """, (rs, row) -> rs.getString(1), eventId, event.batchId()) : null;
        Set<String> requestedKeys = destinations.stream().map(tokens::hash).collect(java.util.stream.Collectors.toSet());
        boolean reuse = priorKeys != null && !priorKeys.isEmpty()
            && priorKeys.size() == requestedKeys.size() && requestedKeys.equals(Set.copyOf(priorKeys));
        String batchId = reuse ? event.batchId() : UUID.randomUUID().toString();
        if (reuse) {
            // Successful destinations stay SENT; only known failures are eligible again.
            jdbc.update("""
                UPDATE alert_delivery_result SET status='PENDING',error_message=NULL
                 WHERE event_id=? AND batch_id=? AND channel='KAKAO_ALIMTALK' AND status='FAILED'
                """, eventId, batchId);
        } else {
            for (int i = 0; i < destinations.size(); i++) jdbc.update("""
                INSERT INTO alert_delivery_result
                    (event_id,batch_id,recipient_key,recipient_label,channel,status)
                VALUES (?,?,?,?,?,'PENDING')
                """, eventId, batchId, tokens.hash(destinations.get(i)),
                "휴대폰 수신처 " + (i + 1), "KAKAO_ALIMTALK");
        }
        jdbc.update("""
            UPDATE alert_event SET delivery_status='SENDING',delivery_error=NULL,
                delivery_batch_id=?,delivery_started_at=CURRENT_TIMESTAMP(6) WHERE id=?
            """, batchId, eventId);
        return new Batch(eventId, batchId);
    }

    public boolean claim(Batch batch, String destination) {
        return jdbc.update("""
            UPDATE alert_delivery_result SET status='SENDING',started_at=CURRENT_TIMESTAMP(6),
                finished_at=NULL,attempt_count=attempt_count+1
             WHERE event_id=? AND batch_id=? AND recipient_key=? AND status='PENDING'
            """, batch.eventId(), batch.id(), tokens.hash(destination)) == 1;
    }

    public void complete(Batch batch, String destination, String status, String error) {
        jdbc.update("""
            UPDATE alert_delivery_result SET status=?,error_message=?,finished_at=CURRENT_TIMESTAMP(6)
             WHERE event_id=? AND batch_id=? AND recipient_key=? AND status='SENDING'
            """, status, error, batch.eventId(), batch.id(), tokens.hash(destination));
    }

    @Transactional
    public void finish(Batch batch) {
        jdbc.update("""
            UPDATE alert_delivery_result SET status='FAILED',error_message='수신 채널이 삭제되었거나 현재 발송할 수 없습니다.'
             WHERE event_id=? AND batch_id=? AND status='PENDING'
            """, batch.eventId(), batch.id());
        summarize(batch, true);
    }

    private void summarize(Batch batch, boolean attempted) {
        List<String> states = jdbc.query("SELECT status FROM alert_delivery_result WHERE event_id=? AND batch_id=?",
            (rs, row) -> rs.getString(1), batch.eventId(), batch.id());
        long sent = states.stream().filter("SENT"::equals).count();
        String status = states.contains("UNKNOWN") ? "UNKNOWN" : sent == states.size() && sent > 0 ? "SENT"
            : sent > 0 ? "PARTIAL" : "FAILED";
        String error = "SENT".equals(status) ? null : "UNKNOWN".equals(status)
            ? "응답을 확인하지 못한 수신처가 있습니다. 중복 발송 방지를 위해 수신 여부를 먼저 확인해주세요."
            : "수신처별 전송 결과를 확인해주세요.";
        jdbc.update("""
            UPDATE alert_event SET delivery_status=?,delivery_error=?,
                last_notified_at=CASE WHEN ? THEN CURRENT_TIMESTAMP(6) ELSE last_notified_at END,
                notification_count=notification_count+?,recipient_snapshot=?
             WHERE id=? AND delivery_batch_id=? AND delivery_status IN ('SENDING','UNKNOWN')
            """, status, error, attempted, attempted ? 1 : 0,
            "{\"channel\":\"KAKAO_ALIMTALK\",\"count\":" + states.size() + ",\"sent\":" + sent + "}",
            batch.eventId(), batch.id());
    }

    @Transactional
    public void resolve(com.pentaworks.monitoring.auth.CurrentUserService.CurrentUser actor,
                        long eventId, long resultId, boolean received) {
        if (!actor.isAdmin()) throw new com.pentaworks.monitoring.common.ForbiddenException("관리자 권한이 필요합니다.");
        String batchId = jdbc.query("SELECT delivery_batch_id FROM alert_event WHERE id=? AND delivery_status='UNKNOWN' FOR UPDATE",
            rs -> rs.next() ? rs.getString(1) : null, eventId);
        if (batchId == null) throw new com.pentaworks.monitoring.common.BadRequestException("현재 결과 확인이 필요한 전송이 아닙니다.");
        int updated = jdbc.update("""
            UPDATE alert_delivery_result SET status=?,error_message=?,finished_at=CURRENT_TIMESTAMP(6)
             WHERE id=? AND event_id=? AND batch_id=? AND status='UNKNOWN'
            """, received ? "SENT" : "FAILED", received ? "관리자가 수신을 확인했습니다." : "관리자가 미수신을 확인했습니다.",
            resultId, eventId, batchId);
        if (updated != 1) throw new com.pentaworks.monitoring.common.BadRequestException("이미 처리되었거나 현재 전송에 속하지 않는 결과입니다.");
        summarize(new Batch(eventId, batchId), false);
        audit.record(actor, "ALERT_DELIVERY_CONFIRMED", "ALERT_EVENT", Long.toString(eventId),
            java.util.Map.of("resultId", resultId, "received", received));
    }

    public List<Result> results(long eventId) {
        return jdbc.query("""
            SELECT d.id,d.recipient_label,d.channel,d.status,d.attempt_count,d.error_message,d.started_at,d.finished_at,
                   d.batch_id=e.delivery_batch_id AS current_batch
              FROM alert_delivery_result d JOIN alert_event e ON e.id=d.event_id
             WHERE d.event_id=? AND d.channel='KAKAO_ALIMTALK' ORDER BY d.id DESC LIMIT 100
            """, (rs, row) -> new Result(rs.getLong(1), rs.getString(2), rs.getString(3), rs.getString(4),
                rs.getInt(5), rs.getString(6), rs.getTimestamp(7) == null ? null : rs.getTimestamp(7).toInstant(),
                rs.getTimestamp(8) == null ? null : rs.getTimestamp(8).toInstant(), rs.getBoolean(9)), eventId);
    }

    @Scheduled(fixedDelay = 60000)
    @Transactional
    public void recoverInterruptedDeliveries() {
        jdbc.update("""
            UPDATE alert_delivery_result d JOIN alert_event e ON e.id=d.event_id AND e.delivery_batch_id=d.batch_id
               SET d.status='FAILED',d.error_message='발송을 시작하기 전에 서버 처리가 중단되었습니다.',
                   d.finished_at=CURRENT_TIMESTAMP(6)
             WHERE e.delivery_status='SENDING' AND e.delivery_started_at<CURRENT_TIMESTAMP(6)-INTERVAL 5 MINUTE
               AND d.status='PENDING'
            """);
        jdbc.update("""
            UPDATE alert_delivery_result d JOIN alert_event e ON e.id=d.event_id AND e.delivery_batch_id=d.batch_id
               SET d.status='UNKNOWN',d.error_message='처리 중 서버 연결이 종료되어 결과를 확인할 수 없습니다.',
                   d.finished_at=CURRENT_TIMESTAMP(6)
             WHERE e.delivery_status='SENDING' AND e.delivery_started_at<CURRENT_TIMESTAMP(6)-INTERVAL 5 MINUTE
               AND d.status='SENDING'
            """);
        jdbc.update("""
            UPDATE alert_event e SET
                e.delivery_status=CASE WHEN EXISTS (
                    SELECT 1 FROM alert_delivery_result d
                     WHERE d.event_id=e.id AND d.batch_id=e.delivery_batch_id AND d.status='UNKNOWN'
                ) THEN 'UNKNOWN' ELSE 'FAILED' END,
                e.delivery_error=CASE WHEN EXISTS (
                    SELECT 1 FROM alert_delivery_result d
                     WHERE d.event_id=e.id AND d.batch_id=e.delivery_batch_id AND d.status='UNKNOWN'
                ) THEN '전송이 중단되었습니다. 수신 여부를 확인해주세요.'
                  ELSE '발송 전에 서버 처리가 중단되었습니다. 다시 시도해주세요.' END
             WHERE delivery_status='SENDING' AND delivery_started_at<CURRENT_TIMESTAMP(6)-INTERVAL 5 MINUTE
            """);
    }

    private record Event(String status, String batchId, Instant lastNotifiedAt) {}
    public record Batch(long eventId, String id) {}
    public record Result(long id, String recipientLabel, String channel, String status, int attemptCount,
                         String errorMessage, Instant startedAt, Instant finishedAt, boolean currentBatch) {}
}
