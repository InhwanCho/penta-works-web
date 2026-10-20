# Workspace history unification — development only

User authorized the recommended improvements, deferring all post-migration cleanup until the full migration is finished. Keep all source IDs, fetched timestamps, snapshot tables, planning baselines, and legacy fallback reads. No Firebase/source/production/intranet writes.

## Implementation

- V46 is additive. Records gain source_id (per-company unique), engineer_name, counts_as_pm, acr_kind, schedule_id. Schedules can have multiple records. UI offers writing a record from a schedule, selecting/removing the link, and navigation both ways. No historical link inferred by date/name.
- Existing record details merge on update to retain unsupported original fields. PM/ACR forms remain JSON; search/calculation fields are synchronized to named columns.
- Imported record UI distinguishes the actual engineer from the import account. No fuzzy mapping of historical people to current accounts.
- Photo/preparation/history/schedule foreign keys enforce company consistency. Asset revision is retained for concurrency protection.
- Snapshot reads are tenant scoped. Imported items are filtered by source identifiers, including soft-deleted/moved records so they cannot reappear as legacy records. Unimported entries still render via the old API. Existing photo URLs resolve against imported photo permissions after import.
- Equipment metadata retains manufacturer, field strength, software, serial and installation details. Imported service links use a unique exact system model; historical version/serial is explicitly unknown, not today's asset state. No synthetic registration history.
- `scripts/import-workspace-snapshots.py` only targets pentaworks_mreyes_dev; requires V46. Backs up nine workspace tables, locks/guards source snapshots, imports atomically, skips existing source IDs. Missing-photo entries remain legacy instead of partially disappearing. Does not overwrite user-edited or deleted imported records on rerun. Refuses native equipment without an explicitly reviewed mapping.

## Deployment/import

- Before-schema backup: `/home/inhwan/backups/mreyes-dev/before-v46-workspace-20261020.sql.gz`.
- Import input enriches the existing snapshot with the Oct 20 read-only Firebase backup (`output/firebase-refresh-20261020/decoded.json` and `legacylogs.json`). Does not fetch Firebase again.
- Outputs/SQL contain private business data; remain untracked under `output/workspace-unification-20261020/`. SQL mode 600.
- Production branch is untouched. No test suites requested; deployment builds only.

## Deferred

- No source_id / fetched_at / snapshot / Office integration removal. No deletion of imported last PM/ACR baselines.
- No blob-to-object-storage move.
- Future refresh must reconcile changes to already imported records: this importer is intentionally insert-only, not a conflict-aware update engine. Retain raw source backups until final reconciliation.
- No claim that the entire Firebase dataset has been migrated: this step covers the current development snapshots. General office logs outside these hospital snapshots and any newer source changes need a later migration pass.
