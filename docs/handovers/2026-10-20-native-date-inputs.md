# Small-screen native date input sizing

User reports the previous schedule-only width fix was insufficient and requests auditing all dates, including new work records. Small screen means width <1024px, not device detection. No separate tests per user; deployment builds only.

Inspected static inputs plus ServiceFields dynamic inputType usage:
- workspace schedule filter and start/end datetime
- work record workDate
- hospital planning PM/ACR date overrides
- asset installation/work date
- service Cold Head receipt date and start/end times
- site-detail custom query range
- alert history from/to dates
- alert snooze until datetime
- notification quiet hours and holidays
- hospital operating hours and exception dates
- overview month navigation (must retain compact width)

Consolidated common date/time CSS: remove native WebKit appearance sizing, apply border-box and shrinkable width, bound internal WebKit editing controls, allow parent labels/fieldsets to shrink. Native picker/value/min/max/validation/event handlers are preserved. Month toolbar retains its existing max-width instead of forcing full width.

Production untouched. Physical iOS Safari rendering not verified; this is a CSS correction based on static inspection, not a claim of device validation.
