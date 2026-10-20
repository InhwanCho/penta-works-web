# Calendar sheet reference and author correction

- User authorized assigning all current development workspace authors to 이재연, jylee@pentaworks.net (app_user id12/company1).
- Transaction updated workspace_record 218 rows and workspace_schedule 5 rows. Engineer names, timestamps and photo uploaders were preserved. Backup author mapping is local untracked `output/workspace-unification-20261020/author-before.json` (600).
- Directly inspected the user's Chrome PENTA SERVICE tab, clicked Oct6, and compared its visible day modal with the development Oct14 sheet. No source site writes.
- Replaced layered CSS day overrides with a single block: work records first, separate white section cards, full-width write action beneath logs, schedule/empty section, calculated due section kept separately.
- Service type has a matching side stripe and badge; record title 2-line clamp, date/status on right, readable supporting text, common workspace hover background. Mobile retains sheet behavior. No inline original schedule creation form was copied; schedule creation continues through its existing page to preserve validation.
- Development only. Actual Chrome UI comparison after deployment is explicitly requested by user.
