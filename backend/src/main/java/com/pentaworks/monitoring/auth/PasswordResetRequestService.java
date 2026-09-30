package com.pentaworks.monitoring.auth;

import com.pentaworks.monitoring.admin.AccountMailService;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Locale;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.task.TaskExecutor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
public class PasswordResetRequestService {
    private static final Logger log = LoggerFactory.getLogger(PasswordResetRequestService.class);
    private final JdbcTemplate jdbc;
    private final SecureTokens tokens;
    private final AccountMailService mail;
    private final TaskExecutor executor;
    private final org.springframework.transaction.support.TransactionTemplate deliveryTransaction;

    public PasswordResetRequestService(JdbcTemplate jdbc, SecureTokens tokens, AccountMailService mail,
                                      @Qualifier("accountMailExecutor") TaskExecutor executor,
                                      org.springframework.transaction.PlatformTransactionManager transactionManager) {
        this.jdbc = jdbc;
        this.tokens = tokens;
        this.mail = mail;
        this.executor = executor;
        this.deliveryTransaction = new org.springframework.transaction.support.TransactionTemplate(transactionManager);
        this.deliveryTransaction.setPropagationBehavior(org.springframework.transaction.TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    @Transactional
    public void request(String rawEmail) {
        String email = rawEmail.trim().toLowerCase(Locale.ROOT);
        String hash = tokens.hash(email);
        Instant now = Instant.now();
        jdbc.update("""
            INSERT IGNORE INTO password_reset_request_limit
                (email_hash,window_started_at,last_requested_at,request_count)
            VALUES (?,?,?,0)
            """, hash, Timestamp.from(now), Timestamp.from(Instant.EPOCH));
        Limit limit = jdbc.query("""
            SELECT window_started_at,last_requested_at,request_count
              FROM password_reset_request_limit WHERE email_hash=? FOR UPDATE
            """, rs -> rs.next() ? new Limit(rs.getTimestamp(1).toInstant(),
                rs.getTimestamp(2).toInstant(), rs.getInt(3)) : null, hash);
        if (limit == null || limit.lastRequested().plusSeconds(60).isAfter(now)) return;
        boolean newWindow = !limit.started().plusSeconds(3600).isAfter(now);
        if (!newWindow && limit.count() >= 3) return;
        jdbc.update("""
            UPDATE password_reset_request_limit
               SET window_started_at=?,last_requested_at=?,request_count=? WHERE email_hash=?
            """, Timestamp.from(newWindow ? now : limit.started()), Timestamp.from(now),
            newWindow ? 1 : limit.count() + 1, hash);
        Account account = jdbc.query("""
            SELECT u.id,u.company_id,u.email,u.name FROM app_user u
              JOIN company c ON c.id=u.company_id
             WHERE u.email=? AND u.status='ACTIVE' AND c.status='ACTIVE'
            """, rs -> rs.next() ? new Account(rs.getLong(1), rs.getLong(2), rs.getString(3), rs.getString(4)) : null, email);
        if (account == null) return;
        String token = tokens.create();
        String id = UUID.randomUUID().toString();
        // A repeated anonymous request must not invalidate a link already delivered to its owner.
        jdbc.update("""
            INSERT INTO password_reset_token (id,user_id,token_hash,created_by,expires_at,created_at)
            VALUES (?,?,?,NULL,?,CURRENT_TIMESTAMP(6))
            """, id, account.id(), tokens.hash(token), Timestamp.from(now.plus(1, ChronoUnit.HOURS)));
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() {
                try { executor.execute(() -> deliver(account, id, token)); }
                catch (RuntimeException error) {
                    recordDelivery(account, id, "FAILED");
                    log.warn("Password reset mail queue is unavailable");
                }
            }
        });
    }

    private void deliver(Account account, String id, String token) {
        String status;
        try { status = mail.sendPasswordReset(account.email(), account.name(), token).name(); }
        catch (RuntimeException error) { status = "FAILED"; }
        recordDelivery(account, id, status);
    }

    private void recordDelivery(Account account, String id, String status) {
        try { deliveryTransaction.executeWithoutResult(transaction -> {
        if (!"SENT".equals(status)) jdbc.update(
            "UPDATE password_reset_token SET revoked_at=CURRENT_TIMESTAMP(6) WHERE id=?", id);
        jdbc.update("""
            INSERT INTO audit_log (company_id,actor_user_id,actor_name,action,target_type,target_id,after_data)
            VALUES (?,NULL,'비밀번호 찾기 요청','PASSWORD_RESET_REQUESTED','APP_USER',?,?)
            """, account.companyId(), Long.toString(account.id()), "{\"deliveryStatus\":\"" + status + "\"}");
        }); } catch (RuntimeException error) { log.error("Password reset delivery result could not be recorded"); }
    }

    @Scheduled(fixedDelay = 3600000)
    public void cleanRequestLimits() {
        jdbc.update("DELETE FROM password_reset_request_limit WHERE last_requested_at < CURRENT_TIMESTAMP(6) - INTERVAL 1 DAY");
    }

    private record Limit(Instant started, Instant lastRequested, int count) {}
    private record Account(long id, long companyId, String email, String name) {}
}
