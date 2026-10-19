# Mobile titles and equipment entry point

Removed duplicated mobile page headings from overview, hospitals, alerts and settings. Overview no longer has a heading-level work-log creation action; selected-date actions remain.

Hospital detail combines the legacy equipment display and current active workspace assets into one equipment/parts panel. A labelled vertical-ellipsis disclosure opens the existing workspace asset manager in a native dialog (mobile bottom sheet), preserving registration, revisions and history. Legacy data remains read-only from its original source; no data is copied or migrated. Retired workspace assets remain accessible in management. Authentication and existing API permissions are retained.

Dev-only deployment, pipeline compilation, no separate browser/tests per prior request.
