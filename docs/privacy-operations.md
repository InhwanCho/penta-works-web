# MReyes privacy requests and backup operations

## Requests

Settings → 개인정보 요청. Users can submit ACCESS/CORRECT/DELETE_ACCOUNT/ERASURE/STOP and see their own 100 latest requests. Up to three open requests; no public unauthenticated endpoint. People unable to log in contact ihcho@pentaworks.net. A company SUPER_ADMIN/PLATFORM_ADMIN can select 회사 요청 관리. Ordinary ADMIN cannot review sensitive requests. Reviews are company-scoped and audit logged without request content. Responses are visible to the requester, not internal notes.

Verify identity and authority before action. Record what was removed and retained. Saving COMPLETED does not erase data. DELETE_ACCOUNT has an explicit guarded action with exact email and confirmation, reuses the existing protection for self/platform/last-super-admin deletion. Account identifiers are anonymized, sessions/reset links revoked, recipients/site access removed, personal rules disabled and Google refresh token/OAuth states cleared. Company work/photo content, request case records and purpose-retained audit logs are NOT blanket-erased. ERASURE requests require a separately reviewed content removal workflow. Deleted accounts cannot log in to see the response; the handler must communicate results independently. Do not claim an email was sent by this feature.

## Google notice

Before connect/reconnect, the user sees payload, other employee data, worldwide Google processing, refusal and disconnect behavior. An unchecked acknowledgement is required; API validates the notice version and stores a receipt. This is a product notice acknowledgement, NOT a declaration that all Korean international-transfer lawful-basis/consent obligations for all data subjects are satisfied. Existing connections are unchanged; OAuth/transfer legal review remains separate.

## Durable deletion journal

Mount `/home/inhwan/privacy-journal/{prod,dev}` to backend `/app/privacy-journal`. Deployment operator must create directories 0700 and empty `deletions.jsonl` 0600 owned by inhwan before first use (do NOT truncate existing journals). Java forces PREPARE before the database changes, then COMMIT or ABORT after transaction completion. File content includes opaque operation UUID, company/user IDs and original creation timestamp only, no names/emails. DB contains minimal committed marker. Never restore this independent current journal from an older database backup.

Unresolved PREPARE means a crash/IO error may have interrupted finalization. Backup can resolve it to COMMIT only when the original live database has the matching committed marker. Otherwise it fails; inspect original transaction outcome before resolving it manually. Do not infer ABORT from an old restored DB. A wrong account ID reused after backup is protected by company + account created_at checks. Current journal must survive host loss independently; copy it together with the encryption key to protected off-host storage through an approved channel. Same-host backups do not provide a disaster/host-loss guarantee.

## Daily backups

`python3 deploy/privacy_backup.py init` creates a local 0600 key at `/home/inhwan/pentaworks-secrets/mreyes-backup.key`, never overwriting an existing key. Keep a protected offline copy separately; do not commit or print it. `backup --mode prod` / `dev` backs up the complete selected DB, workspace-photo files and company-document files, a journal checkpoint and manifest. SQL is compressed, package encrypted using OpenSSL AES-256-CBC/PBKDF2 and independently authenticated with HMAC-SHA256 (encrypt-then-MAC). Authentication is checked before decryption. Managed files are 0600 in 0700 directories under `/home/inhwan/backups/mreyes-managed/{mode}`. After a verified success, managed archives older than 30 days are pruned. Pre-existing manual/incident backups outside this directory are not deleted automatically; inventory separately.

Schedule production 03:40 KST, development 04:00 KST in the server user's crontab, preserving other jobs. New failures print a nonsecret error and leave prior backups. Monitor `/home/inhwan/backups/mreyes-managed/backup.log`; no proactive notification is configured. File and SQL capture are not a single filesystem+database transaction; restore rehearsal checks both. Quiesce uploads for an exact document snapshot when needed.

## Restore rehearsal and actual recovery

Never test on a live schema. First use:

```
python3 deploy/privacy_backup.py restore --mode dev --archive /absolute/backup.tar.gz.enc --target mreyes_privacy_restore_qa --documents-output /absolute/new-qa-documents-directory
```

Requires a new/empty target schema, matching backup mode, valid HMAC/key and CURRENT independent journal with no unresolved deletions. Import then invalidate restored Google authorizations and replay account deletions. It exports document files to a NEW specified folder. It never starts applications or restores files into a live volume automatically. Verify account status, SQL/Flyway integrity and files; remove the disposable schema/files after QA.

Live schema restore is refused unless `--allow-production` is explicit and both relevant frontend/backend are stopped. It STILL requires an empty schema; an operator must separately authorize clearing the damaged/live DB after backup. Stop collectors/writers too; do not run with concurrent DB writes. Preserve journal/key before clearing any schema. Apply pending migrations in an isolated/migration-only environment when restoring a backup older than V55; the helper currently expects V55 or later. Review notification/mail/OAuth settings and permissions before starting services. Reconnect Google deliberately; never start providers as part of a restore test.

Arbitrary record/photo deletions do not yet have a generic tombstone replayer; this journal replays account identifier anonymization and associated access revocation only. Separately review such erasure requests and extend replay scope before promising content erasure across backups.

Photo storage update: managed format2 backups also include the private workspace-photo volume and verify file SHA256 checksums against SQL snapshot references. Restoring format2 requires `--photos-output /absolute/new-photos-folder` in addition to `--documents-output`. Database-only backup/restore is insufficient after BLOB migration. See `docs/handovers/2026-10-21-photo-file-storage.md` for the file migration/recovery procedure.
