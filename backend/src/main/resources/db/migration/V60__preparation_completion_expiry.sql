ALTER TABLE workspace_preparation ADD COLUMN completed_at DATETIME(6) NULL;
-- Historical checks have no completion timestamp. Start their grace period now.
UPDATE workspace_preparation SET completed_at=CURRENT_TIMESTAMP(6) WHERE done=TRUE;
CREATE INDEX idx_preparation_expiry ON workspace_preparation(company_id,done,completed_at);
