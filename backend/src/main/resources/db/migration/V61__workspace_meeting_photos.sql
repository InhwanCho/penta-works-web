ALTER TABLE workspace_photo
 ADD COLUMN meeting_id BIGINT NULL,
 ADD KEY ix_workspace_photo_meeting(meeting_id),
 ADD CONSTRAINT fk_workspace_photo_meeting FOREIGN KEY(meeting_id) REFERENCES workspace_meeting(id),
 ADD CONSTRAINT chk_workspace_photo_single_parent CHECK (record_id IS NULL OR meeting_id IS NULL);
