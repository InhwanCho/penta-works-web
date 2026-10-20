# Firebase refresh into isolated development workspace

Source snapshot fetched 2026-10-20 09:16:34 KST, all five collections (25 hospitals, 270 logs, 65 photos, 14 prep entries, 5 schedules). Stored raw decoded source documents in workspace_firebase_document, including PM/ACR nested details and deleted records. Source remains read-only.

The existing Office integration points at shared intranet data. To honor development-only scope, V44 provides local development Office response/photo snapshots. DevelopmentOfficeSnapshot is only enabled with app.workspace.enabled=true; OfficeAssetsService falls back to the original integration for sites without an imported snapshot. Source hospital services and photographs use the same existing authorized Office endpoints. Existing maintenance IDs and manual/non-Firebase records/components are retained; workspace records/assets are untouched. Raw photos belonging to intranet-only office repairs are retained in raw source, not shown as hospital services. This does not move intranet workshop features into MR.EYES.

New source hospital 네이처영상의학과 has no exact monitoring-site match, so it gets development-only site 900001, assigned to PENTAWORKS and initially hidden from monitoring (no invented telemetry). Existing mapped source hospitals retain their site mappings. Office preparation without a hospital maps to a general preparation rather than being dropped.

Schedules/preparations/planning updates compare prior source snapshots against current development data before replacing source-owned fields; conflicts are reported. Schedule classification and end date are preserved. Deleted sources are not resurrected; explicitly moved/retired legacy rows remain excluded. 24 of 34 newly observed log documents are already deleted test duplicates.

Artifacts, source diff, planned SQL and report: output/firebase-refresh-20261020 (untracked, includes source data). Previous snapshot: output/workspace-service-update/planning-snapshot.json. Read-only office baseline and source mappings are saved alongside the import plan. Local script prepare-import.py builds conflict-aware SQL for pentaworks_mreyes_dev exclusively. Backed up affected development workspace/site/assignment tables to /home/inhwan/backups/mreyes-dev/before-firebase-20261020.sql.gz before migration/import. No production schema or intranet writes.

Deployment pipeline compilation, then apply transaction and read back collection counts/schedule fields/photo counts. No standalone browser tests per user preference.
