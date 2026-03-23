# Admin E2E (Playwright)

## Prerequisites

- Frontend dev server running (default `http://localhost:3000`), or set `E2E_BASE_URL`.
- Admin user in the target environment.

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `E2E_ADMIN_EMAIL` | Yes | Admin or manager login email |
| `E2E_ADMIN_PASSWORD` | Yes | Password |
| `E2E_BASE_URL` | No | SPA origin (default `http://localhost:3000`) |

## Run

```bash
cd e2e
npm install
npx playwright install chromium
cd ..
# Terminal 1: start API + frontend as you normally do for local dev
# Terminal 2:
cd e2e
set E2E_ADMIN_EMAIL=you@example.com
set E2E_ADMIN_PASSWORD=yourpassword
npm test
```

On Unix: `export E2E_ADMIN_EMAIL=...`

Tests are skipped automatically if credentials are unset (CI stays green without secrets).
