# Listing tables and test data

## 1. Verify whether tables exist

From the **backend** directory:

```bash
python -m scripts.verify_listing_tables
```

You should see either all four tables `OK` (cities, listings, listing_images, listing_amenities) or `MISSING` for some.

## 2. Create tables if missing (safe)

`create_all()` only adds missing tables; it does **not** drop or alter existing ones.

```bash
python -m scripts.ensure_listing_tables
```

Run again after that:

```bash
python -m scripts.verify_listing_tables
```

All four should be `OK`.

## 3. Insert test data (compatible with GET /api/apartments)

**Option A – Python (recommended):**

```bash
python -m scripts.seed_listing_test_data
```

This creates: 1 city (Zurich), 1 unit, 1 **published** listing linked to that unit, 1 main image, 2 amenities. Safe to run more than once (skips if the test listing already exists).

**Option B – Raw SQL:**

After tables exist, run the SQL file (e.g. in psql or your SQL client):

```bash
psql -d feelathomenow -f scripts/seed_listing_test_data.sql
```

Use your actual DB name if different. If the script errors on conflict, you can ignore or run once.

## 4. Test in Swagger

1. Start the backend:
   ```bash
   uvicorn server:app --reload --port 8000
   ```

2. Open Swagger UI:  
   **http://localhost:8000/docs**

3. **List apartments**
   - Find **GET /api/apartments**.
   - Click **Try it out**.
   - Optionally set `city` to `Zurich`.
   - Click **Execute**.
   - You should get **200** and a response body with one item (same shape as before: `id`, `title`, `location`, `city`, `price`, `image`, `images`, `description`, `amenities`, etc.).

4. **Single apartment**
   - Find **GET /api/apartments/{apartment_id}**.
   - Click **Try it out**.
   - Set `apartment_id` to the `id` of the listing returned in step 3 (e.g. `c0000000-0000-0000-0000-000000000001` if you used the SQL seed, or the UUID printed by the Python seed).
   - Click **Execute**.
   - You should get **200** and the same listing object.

If PostgreSQL is not configured, the API falls back to Airtable/Mongo; in that case use the same endpoints and you’ll see data from the fallback source instead.
