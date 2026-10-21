package com.pentaworks.monitoring.calendar;

import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executor;
import java.util.concurrent.atomic.AtomicBoolean;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/** Coalesces committed changes; external calls never delay a save or the alert scheduler. */
@Component
public class CalendarSyncDispatch {
    private final JdbcTemplate db;
    private final GoogleCalendarSync sync;
    private final Executor executor;
    private final boolean enabled;
    private final Set<Long> pending = ConcurrentHashMap.newKeySet();
    private final AtomicBoolean running = new AtomicBoolean();

    public CalendarSyncDispatch(JdbcTemplate db, GoogleCalendarSync sync,
            @Qualifier("calendarSyncExecutor") Executor executor,
            @Value("${google.calendar.sync-enabled:false}") boolean enabled) {
        this.db = db; this.sync = sync; this.executor = executor; this.enabled = enabled;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void changed(CalendarChanged change) {
        if (!enabled) return;
        pending.add(change.companyId());
        startWorker();
    }

    // Also repairs missed signals, process restarts, imports and temporary Google failures.
    @Scheduled(fixedDelayString = "${google.calendar.sync-interval-ms:600000}", initialDelay = 15000)
    public void reconcile() {
        if (!enabled) return;
        pending.addAll(db.queryForList("SELECT DISTINCT company_id FROM user_calendar_connection WHERE status='CONNECTED' AND provider='GOOGLE'", Long.class));
        startWorker();
    }

    private void startWorker() {
        if (pending.isEmpty() || !running.compareAndSet(false, true)) return;
        try { executor.execute(this::drain); }
        catch (RuntimeException ignored) { running.set(false); } // Reconcile retries after shutdown/rejection.
    }

    private void drain() {
        try {
            while (!pending.isEmpty()) {
                Long company = pending.iterator().next();
                // Remove before syncing: changes arriving during the run must get a subsequent pass.
                pending.remove(company);
                try {
                    for (Long id : db.queryForList("SELECT id FROM user_calendar_connection WHERE company_id=? AND status='CONNECTED' AND provider='GOOGLE'", Long.class, company)) {
                        sync.sync(id); // Rechecks user/company/site access and records safe per-account errors.
                    }
                } catch (RuntimeException ignored) { /* Retry on the next reconcile; never log secrets. */ }
            }
        } finally {
            running.set(false);
            startWorker(); // Covers a signal arriving between the last loop check and releasing the worker.
        }
    }
}
