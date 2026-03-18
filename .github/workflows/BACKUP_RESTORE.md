# Database backup and restore

## Backup (automated)

- **Workflow:** [backup.yml](.github/workflows/backup.yml)
- **Schedule:** Daily at 03:00 UTC (`cron: '0 3 * * *'`)
- **Manual run:** Actions → Database Backup → Run workflow
- **Output:** Custom-format dump (`.dump`) uploaded to S3/R2 under `backups/YYYY/MM/DD/backup_YYYY-MM-DD_HH-MM.dump`

### Required GitHub Secrets

| Secret           | Description |
|------------------|-------------|
| `DATABASE_URL`   | Full PostgreSQL URL (e.g. from Render). May be `postgres://` or `postgresql+psycopg2://`; workflow normalizes for `pg_dump`. |
| `S3_ACCESS_KEY`  | S3/R2 access key (AWS_ACCESS_KEY_ID–style). |
| `S3_SECRET_KEY`  | S3/R2 secret key. |
| `S3_BUCKET`      | Bucket name. |
| `S3_ENDPOINT`    | S3-compatible endpoint (e.g. R2: `https://<account_id>.r2.cloudflarestorage.com`). Leave empty for AWS S3. |

### Example backup filename

- `backup_2025-03-14_03-00.dump`
- Full path in bucket: `backups/2025/03/14/backup_2025-03-14_03-00.dump`

### Retention

- Keeps the last **14** backups; older ones are deleted automatically.

---

## Restore

Backups are **custom-format** dumps (`.dump`), created with `pg_dump -Fc`. Use `pg_restore`, not `psql`.

### 1. Download the backup

- From **Cloudflare R2 / S3**: use the AWS CLI or dashboard to download the object, e.g.  
  `backups/2025/03/14/backup_2025-03-14_03-00.dump`  
  Save it locally as e.g. `backup.dump`.

Example with AWS CLI (R2):

```bash
export S3_ENDPOINT="https://<account_id>.r2.cloudflarestorage.com"
aws s3 cp "s3://YOUR_BUCKET/backups/2025/03/14/backup_2025-03-14_03-00.dump" ./backup.dump --endpoint-url "$S3_ENDPOINT"
```

### 2. Restore into a database

**Target:** a PostgreSQL database (local or remote). Connection string format:  
`postgresql://user:password@host:port/dbname`

- **Replace contents of an existing database (e.g. local dev):**

  ```bash
  # Drop existing objects and restore (destructive)
  pg_restore -d "$DATABASE_URL" --clean --if-exists backup.dump
  ```

- **Restore into a fresh/empty database (recommended for production):**

  ```bash
  pg_restore -d "$DATABASE_URL" backup.dump
  ```

- **Inspect without restoring:**

  ```bash
  pg_restore -l backup.dump
  ```

If your URL uses `postgres://` or `postgresql+psycopg2://`, `pg_restore` accepts it; use the same URL style as in your app (or `postgresql://`).

### Restore locally (development)

1. Ensure PostgreSQL is running and you have a local DB (e.g. `feelathomenow_local`).
2. Download the desired `.dump` from S3/R2 (see above).
3. Set `DATABASE_URL` to your local DB, then run:

   ```bash
   export DATABASE_URL="postgresql://user:pass@localhost:5432/feelathomenow_local"
   pg_restore -d "$DATABASE_URL" --clean --if-exists backup.dump
   ```

4. If you see “errors” about pre-existing objects, they are often safe to ignore; check that data and schema look correct.

### Restore to production (Render)

⚠️ **Use with care:** restoring over production will overwrite live data.

1. Prefer restoring into a **separate** PostgreSQL instance (e.g. a temporary Render DB or a staging DB), then validate before switching the app.
2. If you must restore over the current production DB:
   - Put the app in maintenance or stop writes.
   - Take a fresh backup of production (if possible) before overwriting.
   - Download the desired backup from S3/R2.
   - Use Render’s `DATABASE_URL` (or the internal URL) with `pg_restore`:
     ```bash
     pg_restore -d "$DATABASE_URL" --clean --if-exists backup.dump
     ```
   - Handle conflicts (e.g. active connections, extensions). You may need to drop/recreate the database or restore to a new DB and then repoint the app.
3. Re-enable the application and verify.

### If you had used plain SQL (`.sql`) instead of `.dump`

- Restore with:
  ```bash
  psql "$DATABASE_URL" < backup.sql
  ```
- Our pipeline uses `.dump` (custom format) for smaller size and more flexible restore options.

---

## Assumptions and limitations

- **Secrets:** All credentials live in GitHub Secrets; none are hardcoded.
- **R2 vs S3:** Same workflow; set `S3_ENDPOINT` for R2; leave it empty for AWS S3.
- **Retention:** Exactly the last 14 backup **files** are kept (by path sort); no calendar-based retention.
- **Single DB:** Backup is for the database in `DATABASE_URL` only (one dump per run).
- **Restore:** Manual; no automated restore in CI. Restore is always an operator decision.
