# Planning visibility, pre-visit checklist and day dialog

Audit: workspace_hospital_plan was consumed by overview due calculations but had no frontend editor despite its admin-only PUT API. Added a hospital-detail inspection-plan section displaying PM interval and PM/ACR manual dates; admin can edit through existing API, ordinary users can view. Last imported PM/ACR dates remain calculation baselines, not independently editable maintenance records. History still lives in hospital service history. No schema changes.

Renamed user-facing preparation wording to '방문 전 확인사항' across overview, work editor/details and validation errors, keeping existing prepItems/API/storage compatibility. It supports parts to bring and checks/contact tasks, one per line.

Rebuilt selected-day dialog into separate registered schedules, calculated inspection deadlines and work logs. Fixed-width category pills occupy a top metadata line; hospital/main title and description are full width. Dates, authors, status have separate labels. Neutral rows replace identically colored cards; deadline help explicitly distinguishes calculated due dates from confirmed visits. Due links open hospital inspection-plan section. Two full-width creation actions align at top. Existing native dialog focus/scroll behavior retained.

Dev only, pipeline compilation; no separate tests/browser verification per prior preference.
