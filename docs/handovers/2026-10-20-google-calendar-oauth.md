# Google Calendar OAuth connection

Implementation only; not deployed. Existing production credentials remain outside Git at ~/.config/mreyes/google-calendar-production.json. Rotate the exposed client secret before server configuration.

## Configuration
Set GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET, GOOGLE_CALENDAR_REDIRECT_URI, GOOGLE_CALENDAR_ENCRYPTION_KEY in the target server environment. Encryption key must be a persistent base64-encoded 32-byte random key; changing it requires reconnecting users. Do not share encryption keys across environments. Compose forwards these values. Without configuration, Settings shows the connection as unavailable.

Production redirect URI: https://app.pentaworks.net/api/v1/integrations/google-calendar/callback

Google project requires Calendar API, external consent, calendar.app.created scope, and each connecting account in test users while Testing. Public launch requires the appropriate Google publishing/verification process.

## Endpoints
- GET /api/v1/integrations/google-calendar: authenticated per-user status, no tokens returned.
- POST /api/v1/integrations/google-calendar/connect: authenticated, returns Google authorization URL and sets Secure HttpOnly SameSite=Lax browser-binding cookie.
- GET /api/v1/integrations/google-calendar/callback: public, requires single-use hashed state + browser cookie, 10-minute expiry, active same-company account. Exchanges code server-side; creates/reuses app calendar; encrypts refresh token with AES-256-GCM; redirects to /settings with generic outcome only.
- DELETE /api/v1/integrations/google-calendar: authenticated local disconnect, invalidates pending authorization and clears refresh token. Keeps calendar ID and existing events for reuse. Does not revoke Google's account-side permission; users may revoke that in Google account settings.

V48 adds user_calendar_connection, calendar_oauth_state, calendar_event_mapping. Mapping reserved for subsequent schedule synchronization. app_user unchanged. No schedules exported, no sync worker, no event writes except creating the empty app calendar during explicit consent. UI explicitly explains this limitation. Google token refresh/revocation monitoring and schedule synchronization are follow-up work, not claimed as implemented.

No production environment changes, database writes, commits/pushes or deployment performed as part of implementation. Build only; no test suite requested.
