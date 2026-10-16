# Mobile management and search highlight

Development only. ManagementTabs uses native radio choices for mobile instead of a select when there are more than three sections. Account filters, role/status editors and invitation roles use radios. Account and audit tables reflow to labelled cards below 640px; account editing opens directly beneath the selected card, with a single editor instance. Desktop retains tables.

Company registration sticky positioning is restricted to desktop, fixing mobile content overlap. Company-level site assignments are behind an explicit collapsed disclosure rather than showing a full hospital list below company records. No company/site permissions, assignments or APIs changed. Search navigation highlight stays solid for 5.2 seconds, then fades over 1.3 seconds (6.5 seconds total).

Following the prior user preference, no standalone tests/browser verification; deployment compilation only. Production is excluded.
