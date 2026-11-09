UPDATE workspace_schedule s
SET s.deleted_at = CURRENT_TIMESTAMP(6), s.revision = s.revision + 1
WHERE s.deleted_at IS NULL
  AND EXISTS (
      SELECT 1
      FROM workspace_record r
      WHERE r.company_id = s.company_id
        AND r.schedule_id = s.id
        AND r.site_id <=> s.site_id
        AND r.deleted_at IS NULL
  );
