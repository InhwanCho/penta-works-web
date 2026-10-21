# Workspace photo storage

Workspace photo binaries are stored outside MariaDB in separate dev/prod Docker named volumes `workspace_photos` mounted at `/app/data/workspace-photos`. The storage is private, not a public web directory. Database rows retain company/record/author metadata plus immutable UUID full/preview keys, SHA256 checksums and preview size. GET photo/preview/metadata always authorizes company and hospital access before reading files. Existing photo IDs and record links do not change.

V57 makes the old BLOB nullable. Maintenance migrates each legacy row in its own transaction: preserve full bytes, generate preview, durable file write, readback/hash check, update keys and clear BLOB. Failures retain the BLOB for authorized fallback/retry; migration never silently replaces a missing referenced file with a different image. Invalid legacy photos remain in BLOB until investigated. Completed files have0600 permissions inside0700 directories. Full-size existing files are preserved byte-for-byte; current upload limits/client resizing stay in place. Preview is a JPEG quality80 image of at most500 pixels on the long edge, applies JPEG EXIF orientation, flattens transparency onto white and uses the first frame of GIFs.

Frontend loads previews as cards approach the viewport. Opening a photo fetches full bytes into an authenticated modal; the blob URL is released after closing. Previews do not replace the full image. Upload and record/author quota rules stay in place. Unattached DB uploads expire after24hours; hourly maintenance also removes unreferenced photo files older than24hours. Removed file bytes are not versioned by record history.

Managed backups now use format2 and include the photo volume. Referenced full/preview keys and SHA256 values are extracted from the SQL snapshot and checked against the copied files. Missing or corrupted referenced files make backup/restore fail before pruning/importing. Concurrent file cleanup can cause a backup to fail conservatively; retry after resolving. A database-only backup is insufficient once BLOBs are migrated.

Restore rehearsal requires a separate empty output folder for photos:

```
python3 /home/inhwan/ops/mreyes-privacy-backup.py restore --mode dev --archive /absolute/archive.tar.gz.enc --target mreyes_photo_restore_qa --documents-output /absolute/new-qa-documents --photos-output /absolute/new-qa-photos
```

Restore does not copy files into live volumes or start applications. During actual recovery restore exported photos into the correct environment's volume before restarting, with database references and checksums verified. Earlier format1 backups retain BLOBs and can regenerate file storage after migrations/startup. Current backups and independently stored deletion journal/key are still required.

Validation: file/preview byte integrity, long-edge500/aspect ratio, JPEG EXIF rotation, path traversal/symlink rejection, failed migration retaining DB bytes, orphan cleanup safety, snapshot backup file integrity, frontend build. Deployment checks compare all legacy database hashes to migrated files, ensure BLOB count0 and exercise authorized thumbnail/full endpoints; restore rehearsal validates the encrypted archive and all photo references.
