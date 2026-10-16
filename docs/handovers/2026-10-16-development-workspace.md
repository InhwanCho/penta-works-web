# Development employee workspace

User requested development-only implementation of the approved app navigation. No production deployment or production database migration is authorized.

- Mobile bottom navigation and desktop sidebar: Today, Monitoring, Hospitals, Work, Schedule. Existing monitoring moved to /monitoring; old root query links redirect there.
- Single work creation page with FIELD/GENERAL selection inside the form. Basic company-scoped text records support create/list/edit/soft delete and hospital authorization. Schedules support create/list/delete, team/my view and date selection. Hospital detail connects records and creation.
- Intranet-only workshop/manual/accounting/HR excluded.
- Production schema copied once to pentaworks_mreyes_dev, with dedicated mreyes_dev account. Copied sessions/password reset tokens removed; invitations expired in the copy. Development JWT signing secret separated. Production tables/env/containers untouched.
- Development Compose hard-disables MAIL_ENABLED, BARO_KAKAO_ENABLED, MONITOR_SCHEDULER_ENABLED, MRTB_SYNC_ENABLED and blanks CRON_SECRET. Workspace API explicitly enabled only in development.
- API same-origin proxy supports LAN and Tailscale development URLs. Snapshot measurement data is not live-synchronized.
- Legacy service history/photos remain available via existing read-only Office API. Full Pentaservice form/photo migration remains later work.
- Validation: frontend lint/typecheck/build and 73 existing frontend tests; backend test suite including company/site/author access tests. Deployed verification recorded separately in output.
