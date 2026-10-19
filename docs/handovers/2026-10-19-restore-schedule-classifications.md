# Restore omitted schedule classifications

The original planning importer discarded personalKind and type even though they are present in the retained Firebase snapshot. V43 adds target_kind, personal_kind and service_type and restores classifications for the five imported source IDs. This patch restores metadata only; it does not refetch Firebase or overwrite dates/notes. Three leave entries (신대표님, 조대표님, 전무님), one PM and one ETC hospital schedule are corrected.

Schedule API now returns and stores these fields. Creation uses explicit target/category choices. Schedule list, calendar chips, day dialog and summary rows display the category. Unknown existing classifications are labelled rather than guessed. Local historical importer output/workspace-service-update/import-planning-snapshot.py was also corrected to preserve these fields on future imports; this output folder is intentionally untracked.

Snapshot source: fetched 2026-10-16 15:00:33 KST, imported 15:05:19 KST. No Firebase writes. Dev only. Pipeline build; no separate tests/browser run per prior preference. Read back the five imported classifications after deployment to confirm the data restoration.
