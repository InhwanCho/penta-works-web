# Google Calendar schedule projection

Adds V50 payload hash / sync result fields and GoogleCalendarSync. Production-only scheduler (every 60 seconds, initial 15 seconds); explicitly disabled in dev compose. Existing OAuth encrypted refresh tokens are reused; no additional scope or consent required (calendar.app.created).

Only workspace_schedule rows currently visible to the connected active user's company and site assignments are exported. No work records, computed inspection deadlines, photos, metric data or invitations. Korea timezone; legacy all-day inclusive date converted to Google's exclusive end date. Titles include source classification; notes escaped for Google HTML description, MReyes detail link included. Google reminders disabled.

Each connection is locked in a DB transaction during sync, serializing with disconnect/reconnect. Stable per-connection/schedule/calendar event IDs make retries idempotent even if a prior API create succeeded before DB rollback. Payload hashes skip unchanged events. Local schedule deletion or permission removal deletes only mapped projection events. Manual Google changes are not imported; Google-only deletion currently surfaces a sync error on the next changed local event (no automatic resurrection). One-way projection: edit in MReyes.

Refresh token invalid_grant/401 marks RECONNECT_REQUIRED. Safe error codes persisted; no credential/error body logging. Each failed attempt retries at the next scheduled run. Manual POST /api/v1/integrations/google-calendar/sync is authenticated and operates only on current user's connection. UI reports last successful sync, projected event count and errors; retains compact Settings presentation.
