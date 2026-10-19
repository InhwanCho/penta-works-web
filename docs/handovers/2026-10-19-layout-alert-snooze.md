# Development: overview, hospital assets and personal alert snooze

Overview's page container no longer inherits the legacy two-column card grid. Overview/hospital list header descriptions are hidden below 1024px. Hospital assets are grouped into active MRI equipment, active parts and collapsed retired assets; mobile forms/actions use one column and editing scrolls into view.

V42 adds alert_snooze keyed by personal rule ID and event type (LOW/HIGH/missing are distinct). Authenticated users may pause their own accessible events until an explicit UTC instant up to seven days ahead; null resumes. GET /alerts/snoozes returns active personal pauses. Alert confirmation cards offer 1/3/6/24-hour presets or a Korean-time date/time and resume action. Pausing does not acknowledge or recover the event. Settings persist across sessions, including a new occurrence of the same personal rule/type. Existing acknowledgements and repeat policy still apply after expiry.

Monitor filters paused events before bundling and delivery begin/claim recheck. Already in-flight external sends cannot be recalled. Unsent PENDING events remain eligible even for one-shot rules, allowing a first send after pause expiry. Delivery providers/schedulers remain disabled in development.

User requested no standalone tests/browser verification in prior work; only deployment build. Deploy dev only, never production.
