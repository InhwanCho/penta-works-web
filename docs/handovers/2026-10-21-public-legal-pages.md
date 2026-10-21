# Public legal pages and footer — development draft

/about, /privacy and /terms render without authentication. The monitoring root route remains unchanged. Canonicals are explicit. Public policy pages skip workspace navigation even for signed-in users. Desktop workspace/public pages get a small footer; mobile uses settings links and always-visible login links. Privacy and terms have prominent draft notices and unresolved items rather than invented controller contact, retention periods or processing recipients.

User was asked for the operator's registered name, privacy contact and retention policy. Provider contracts, third-party/cross-border disclosures, officer details and deletion/backup retention must also be finalized before production publication or Google OAuth review. Google integration disclosures describe the actual calendar.app.created scope, projection of accessible records/schedules/deadlines, encrypted refresh token storage and the fact that disconnect leaves Google calendar entries in place. No Google Console changes were made.

Deploy this draft to DEVELOPMENT ONLY. Do not push the draft commit to main until actual policies and operator details are confirmed and incorporated. Frontend build verifies public routes. Browser tools were unavailable in the preceding task (Work local browser use disabled); do not claim visual QA.
