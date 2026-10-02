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
        Event event = jdbc.query("SELECT delivery_status,delivery_batch_id,last_notified_at FROM alert_event WHERE id=? AND recovered_at IS NULL FOR UPDATE",
            rs -> rs.next() ? new Event(rs.getString(1), rs.getString(2), rs.getTimestamp(3) == null ? null : rs.getTimestamp(3).toInstant()) : null, eventId);
        if (event == null || "SENDING".equals(event.status()) || "UNKNOWN".equals(event.status())) return null;
        if (!retry && event.lastNotifiedAt() != null && event.lastNotifiedAt().plusSeconds(60).isAfter(Instant.now())) return null;
        if (retry && !List.of("FAILED", "PARTIAL", "SKIPPED").contains(event.status())) return null;
        List<String> priorKeys = retry && event.batchId() != null ? jdbc.query("""
            SELECT recipient_key FROM alert_delivery_result
             WHERE event_id=? AND batch_id=? AND channel='KAKAO_ALIMTALK'
            """, (rs, row) -> rs.getString(1), eventId, event.batchId()) : null;
        boolean reuse = priorKeys != null && !priorKeys.isEmpty();
        String batchId = reuse ? event.batchId() : UUID.randomUUID().toString();
        if (reuse) {
            // Successful destinations stay SENT; only known failures are eligible again.
            jdbc.update("""
                UPDATE alert_delivery_result SET status='PENDING',error_message=NULL
                 WHERE event_id=? AND batch_id=? AND channel='KAKAO_ALIMTALK' AND status='FAILED'
                """, eventId, batchId);
        }
        Set<String> existingKeys = reuse ? Set.copyOf(priorKeys) : Set.of();
        for (int i = 0; i < destinations.size(); i++) {
            if (existingKeys.contains(tokens.hash(destinations.get(i)))) continue;
            jdbc.update("""
                INSERT INTO alert_delivery_result
                    (event_id,batch_id,recipient_key,recipient_label,channel,status)
                VALUES (?,?,?,?,?,'PENDING')
                """, eventId, batchId, tokens.hash(destinations.get(i)),
                "휴대폰 · " + maskedDestination(destinations.get(i)), "KAKAO_ALIMTALK");
        }
        jdbc.update("""
            UPDATE alert_event SET delivery_status='SENDING',delivery_error=NULL,
                delivery_batch_id=?,delivery_started_at=CURRENT_TIMESTAMP(6) WHERE id=?
            """, batchId, eventId);
        return new Batch(eventId, batchId);
    }

    private static String maskedDestination(String destination) {
        String phone = destination.substring(destination.lastIndexOf(':') + 1);
        return "••••" + phone.substring(Math.max(0, phone.length() - 4));
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

    public void accepted(Batch batch, String destination, String receipt) {
        jdbc.update("""
            UPDATE alert_delivery_result SET status='SENT',error_message=NULL,
                provider_receipt=?,finished_at=CURRENT_TIMESTAMP(6)
             WHERE event_id=? AND batch_id=? AND recipient_key=? AND status='SENDING'
            """, receipt, batch.eventId(), batch.id(), tokens.hash(destination));
    }

    public List<ProviderReceipt> pendingProviderReceipts() {
        return jdbc.query("""
            SELECT id,provider_receipt FROM alert_delivery_result
             WHERE provider_receipt IS NOT NULL AND provider_final_at IS NULL
               AND started_at>CURRENT_TIMESTAMP(6)-INTERVAL 2 DAY
               AND (provider_checked_at IS NULL OR provider_checked_at<CURRENT_TIMESTAMP(6)-INTERVAL 1 MINUTE)
             ORDER BY provider_checked_at ASC LIMIT 50
            """, (rs, row) -> new ProviderReceipt(rs.getLong(1), rs.getString(2)));
    }

    public void recordProviderStatus(ProviderReceipt receipt, BaroKakaoService.ProviderStatus state) {
        String sms = state.smsSendState();
        // Barobill does not document a fixed SmsSendState vocabulary. Keep polling
        // failed Kakao sends so a later SMS fallback outcome is not missed.
        boolean finalState = state.sendStatus() == 1 || state.sendStatus() == 4;
        jdbc.update("""
            UPDATE alert_delivery_result SET provider_send_status=?,provider_result_code=?,
                provider_result_message=?,sms_send_state=?,provider_checked_at=CURRENT_TIMESTAMP(6),
                provider_final_at=CASE WHEN ? THEN CURRENT_TIMESTAMP(6) ELSE provider_final_at END
             WHERE id=? AND provider_receipt=? AND provider_final_at IS NULL
            """, state.sendStatus(), state.resultCode(), truncate(state.resultMessage(), 500),
            truncate(sms, 120), finalState, receipt.id(), receipt.value());
    }

    private static String truncate(String value, int length) {
        return value == null || value.length() <= length ? value : value.substring(0, length);
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
                   d.provider_send_status,d.provider_result_code,d.provider_result_message,d.sms_send_state,d.provider_checked_at,
                   d.batch_id=e.delivery_batch_id AS current_batch
              FROM alert_delivery_result d JOIN alert_event e ON e.id=d.event_id
             WHERE d.event_id=? AND d.channel='KAKAO_ALIMTALK' ORDER BY d.id DESC LIMIT 100
            """, (rs, row) -> new Result(rs.getLong(1), rs.getString(2), rs.getString(3), rs.getString(4),
                rs.getInt(5), rs.getString(6), rs.getTimestamp(7) == null ? null : rs.getTimestamp(7).toInstant(),
                rs.getTimestamp(8) == null ? null : rs.getTimestamp(8).toInstant(),
                rs.getObject(9) == null ? null : rs.getInt(9), rs.getObject(10) == null ? null : rs.getInt(10),
                rs.getString(11), rs.getString(12),
                rs.getTimestamp(13) == null ? null : rs.getTimestamp(13).toInstant(), rs.getBoolean(14)), eventId);
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
    public record ProviderReceipt(long id, String value) {}
    public record Result(long id, String recipientLabel, String channel, String status, int attemptCount,
                         String errorMessage, Instant startedAt, Instant finishedAt, Integer providerSendStatus,
                         Integer providerResultCode, String providerResultMessage, String smsSendState,
                         Instant providerCheckedAt, boolean currentBatch) {}
}
