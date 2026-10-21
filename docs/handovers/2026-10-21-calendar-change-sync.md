# Calendar change-triggered sync with ten-minute reconciliation

Workspace record create/update/delete, schedule create/delete, inspection-plan changes, hospital metadata/access changes, and OAuth connection/reconnection publish CalendarChanged(companyId). The listener runs AFTER_COMMIT; rolled-back saves do not enqueue work. A dedicated single-thread executor coalesces pending companies and syncs all connected users for each company, retaining per-user site access checks. A change arriving during a sync triggers another pass. Saving work does not wait for external Google calls, and Google I/O does not occupy the shared alert scheduler.

The former one-minute full-account scheduler was removed. Reconciliation queues connected companies after startup and every 600000ms (GOOGLE_CALENDAR_SYNC_INTERVAL_MS, default ten minutes), covering process restarts, imports, missed signals and transient failures. Pending changes are in memory; a restart is repaired by startup reconciliation. Existing manual sync remains available and connection-row locks serialize it with background sync/disconnect. Content hashes still skip unchanged event writes.

The settings note says '변경 시 자동 반영 · 10분마다 재확인'. OAuth publishing state itself is a separate Google Cloud Console setting and was not changed by this deployment.

Validation: GoogleCalendarSync/Controller tests, Workspace tests, new dispatcher tests for commit/rollback timing, company coalescing, account fanout, changes during sync, disabled development and reconciliation; backend bootJar; frontend production build. No test calendar entries created in production.
