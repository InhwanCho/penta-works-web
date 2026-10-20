# Hospital registration and management (development only)

User approved regular service-only hospitals: create/edit, per-staff access, equipment/history/schedules, and later monitoring attachment. Keep confirmed monitoring schema and migration artifacts intact. Also align planning help caret vertically. No test suites: only build/deployment.

## Additive model

- V47 `workspace_hospital`: independent numeric hospital id, company, stable site_id bridge, full hospital name, nullable monitoring_site_id, notes, revision, timestamps. Company/site FKs and tenant monitoring-link uniqueness.
- Existing workspace/Office references remain unchanged. Existing 900001 (네이처영상의학과), 900002 (대구 신세계영상의학과) become explicitly unconnected; dashboard visibility is no longer used to infer connection state. Existing monitoring links remain unchanged, including hidden monitoring sites.
- Legacy `site.name` is only VARCHAR(20). Do not widen confirmed monitoring schema: full names live in the registry and site_profile; compatibility site names are limited to 20 codepoints. New bridge IDs are h- plus 24 hex chars, not invented numeric sensor IDs.
- No snapshots, source IDs, dates or original Firebase migration fields removed.

## UI/API

- Hospital list has an admin registration button, with the same company/user access filtering. Marks service-only vs connected.
- Hospital detail shows address, contact, notes and admin edit action. Unconnected detail skips MRTB queries and hides latest collection, threshold actions, thresholds, sampling filters and charts. Equipment/planning/work history remain usable.
- Register optional initial MRI model/serial. Later equipment/components managed through existing UI. Staff selection is only same-company active USER accounts; company admins retain inherent access.
- POST /workspace/hospitals, GET/PUT /workspace/hospitals/{siteId}, GET /workspace/hospitals/options. Auth scoped by company; update revision check, transactions, audit log. Phone and contact optional.
- Later attachment only offers company-owned unclaimed collection sites without existing workspace/snapshot data; no fuzzy automatic hospital merge. Target company_site locked and availability rechecked. Existing attached sensor cannot be reassigned/unlinked by this form; that requires a separate explicit migration to preserve history. Dashboard visibility is still separate admin setting.
- Canonical hospital mapping lets a dashboard sensor link reach the original hospital service records after attachment. Staff assignments to a sensor also recognize its same-company canonical hospital; hospital form writes corresponding assignments on both IDs. No cross-company inference.
- New registered hospital without an Office snapshot gets empty local Office lists, not an intranet connectivity error. Existing snapshots keep their partial-migration fallback.
- Planning help uses a real SVG chevron, flex-aligned, rotated open. Removed both old text pseudo-carets to avoid duplicate arrows.

## Backup and validation

Before migration backup: `/home/inhwan/backups/mreyes-dev/before-hospital-registry-v47-20261020.sql.gz` (13 relevant tables including sites/permissions/workspace).
Local build checks and Jenkins deploy only, no browser/manual data mutation/test records. New provisioning path not claimed as physically device-tested.

Deferred: source cleanup, migrating workspace references from bridge IDs entirely, monitoring reassignment/merges, object storage.
