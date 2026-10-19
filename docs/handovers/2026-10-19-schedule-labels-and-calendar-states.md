# Schedule clarity and calendar interaction backgrounds

Calendar hover/selected/pressed cells keep the normal paper background, with distinct hover/selected borders and today's date marker retained. Both themes updated. Adjacent-month cells remain muted.

Schedule list explicitly labels hospital and registering author, omits missing hospital instead of displaying a dangling separator, and hides body text identical to title. Full-day bounds 00:00–23:59 display as '종일'; multiday entries show the date span. Calendar day-dialog uses the same time label. '내 일정' is renamed to '내가 등록한 일정' to match its existing author filter, and rows sort chronologically. Delete remains confirmed and permission-controlled, now behind an ellipsis disclosure. Mobile date selector fills the width and decorative header description is hidden.

Dev deployment only. No separate tests/browser verification per prior preference; pipeline compilation required.
