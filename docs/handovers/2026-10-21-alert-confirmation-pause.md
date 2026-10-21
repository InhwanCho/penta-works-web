# Alert confirmation pauses for 24 hours

Confirmation (single or bulk) now upserts a 24-hour acknowledgement expiry and pauses the same personal rule/event type for 24 hours. Explicit pause changes update acknowledgement expiry across matching owned events; resume expires their suppression immediately. Delivery recipient queries ignore expired acknowledgements, and active alert lists/dashboard become unacknowledged again after expiry. Recovered history retains its confirmation marker. Repeat interval and one-shot preferences still govern subsequent delivery.

V54 adds repeat_until, backfills existing confirmations from their original acknowledgement time plus 24 hours, and preserves explicitly selected pause deadlines. No alert rule thresholds or other users' settings are changed.

The detail editor defaults to 24 hours, shows radio presets (1/3/6/24), separate Korean-time date/time fields with matching 48px height, explicit apply/cancel and existing resume. Mutations refresh pause, alert and dashboard data. Help/confirmation messages describe the new behavior.

Validation: backend alert event/recipient/search tests and bootJar; frontend production build, alert and mutation feedback tests; actual MariaDB temporary-table migration/expiry/change/resume checks. The opt-in standalone MariaDB Java integration test was extended but requires its isolated QA database to execute. Browser UI inspection was unavailable because local browser use is disabled in Work settings.
