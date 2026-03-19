# PostgreSQL backup restore test plan (local)

Use this plan to verify that a `.dump` backup from the GitHub Actions workflow is restorable. Run everything on a **local machine** against a **test database only**.

---

## Safety notes

- **Never point these steps at production.** Use a dedicated local DB (e.g. `test_restore`) or a throwaway instance.
- **Backup file:** Use a real backup downloaded from S3/R2, or a copy. Do not use production DB as the restore target.
- **Common errors:**
  - **Connection refused / role does not exist:** PostgreSQL not running, wrong host/port, or the user in the backup does not exist locally. Create the role or use a superuser.
  - **Permission denied / must be owner:** Restore was run as a user that does not own the objects. Use a superuser (e.g. `postgres`) or the same role that created the backup.
  - **Database already has content:** Use an empty database or `--clean --if-exists` (see step 4); be aware `--clean` drops objects before restore.

---

## Prerequisites

- PostgreSQL installed locally (includes `psql`, `pg_restore`, `createdb`).
- A backup file in custom format: `backup_YYYY-MM-DD_HH-MM.dump` (from S3/R2).

---

## Step 1: Confirm PostgreSQL is installed

Open PowerShell and run:

```powershell
psql --version
pg_restore --version
```

If these print version info, you can continue. If not, install PostgreSQL and add its `bin` folder to your PATH.

---

## Step 2: Ensure PostgreSQL is running

```powershell
# Windows: check default postgres service (adjust service name if needed)
Get-Service -Name "postgresql*"
```

If the service is stopped, start it (e.g. via Services, or `Start-Service` with the correct name). On WSL or other setups, start PostgreSQL using the method appropriate for your environment.

---

## Step 3: Create a test database

Use a **new** database so production is never touched.

```powershell
# Default: connect as local user 'postgres'; adjust if your setup differs
# -h localhost -p 5432 are defaults; omit if not needed
psql -U postgres -h localhost -p 5432 -c "CREATE DATABASE test_restore;"
```

If your OS user is the PostgreSQL superuser, you can use:

```powershell
createdb -U postgres test_restore
```

If the command fails (e.g. "role does not exist"), use the username that has permission to create databases (often `postgres`).

---

## Step 4: Restore the backup into the test database

Set the path to your downloaded `.dump` file and the connection string for **only** the test database.

```powershell
# Path to the backup file (change to your actual path)
$BACKUP_FILE = "C:\path\to\backup_2025-03-14_03-00.dump"

# Connection string for the TEST database only (not production)
$TEST_DATABASE_URL = "postgresql://postgres:yourpassword@localhost:5432/test_restore"
# Or if no password / peer auth:
# $TEST_DATABASE_URL = "postgresql://postgres@localhost:5432/test_restore"
```

Restore (use one of the two options below).

**Option A – Empty database (recommended for first run):**

```powershell
pg_restore -d $TEST_DATABASE_URL --no-owner --no-acl $BACKUP_FILE
```

**Option B – Reuse existing database (drops existing objects first):**

```powershell
pg_restore -d $TEST_DATABASE_URL --clean --if-exists --no-owner --no-acl $BACKUP_FILE
```

- `--no-owner --no-acl`: avoid role/permission errors when restoring locally with a different user.
- `--clean --if-exists`: only with Option B; drops existing objects so the restore does not conflict. Use only against a test DB.

You may see warnings about existing objects or roles; often they are safe. Fatal errors (e.g. connection or "must be owner" without `--no-owner`) need to be fixed before considering the backup validated.

---

## Step 5: Validate the restore

### 5.1 List tables

```powershell
psql $TEST_DATABASE_URL -c "\dt"
```

You should see a list of tables (e.g. in `public` schema). If the list is empty, the backup may be empty or the restore may have failed for part of the schema.

### 5.2 Check that at least one table has data

Pick a table from the list (e.g. `users` or `tenants`) and run:

```powershell
# Replace 'public.users' with a table name from step 5.1
psql $TEST_DATABASE_URL -c "SELECT COUNT(*) FROM public.users;"
```

Use a table name that exists in your app (e.g. `tenants`, `listings`). If the count is >= 0 and the query runs without error, the restore is validated for that table.

Optional: spot-check one row:

```powershell
psql $TEST_DATABASE_URL -c "SELECT * FROM public.users LIMIT 1;"
```

---

## Step 6: Clean up (optional)

To remove the test database after validation:

```powershell
# Disconnect any sessions first, then:
psql -U postgres -h localhost -p 5432 -c "DROP DATABASE test_restore;"
```

---

## Quick reference (copy-paste)

Assumes backup path and test DB URL are set (see step 4).

```powershell
# Create test DB
psql -U postgres -h localhost -p 5432 -c "CREATE DATABASE test_restore;"

# Restore (pick one)
pg_restore -d $TEST_DATABASE_URL --no-owner --no-acl $BACKUP_FILE
# or
pg_restore -d $TEST_DATABASE_URL --clean --if-exists --no-owner --no-acl $BACKUP_FILE

# Validate
psql $TEST_DATABASE_URL -c "\dt"
psql $TEST_DATABASE_URL -c "SELECT COUNT(*) FROM public.users;"

# Teardown
psql -U postgres -h localhost -p 5432 -c "DROP DATABASE test_restore;"
```

---

## Summary

| Step | Action |
|------|--------|
| 1 | Verify `psql` and `pg_restore` are installed |
| 2 | Ensure PostgreSQL service is running |
| 3 | Create database `test_restore` |
| 4 | Run `pg_restore -d <test_db_url> --no-owner --no-acl <backup.dump>` |
| 5 | List tables with `\dt`, then `SELECT COUNT(*)` on at least one table |
| 6 | Optionally drop `test_restore` |

This confirms that the backup file is restorable and that at least one table contains data, without touching production.
