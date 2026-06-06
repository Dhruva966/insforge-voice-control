# db/ — Database Migrations

InsForge Postgres migrations. Always use `npx @insforge/cli` — never global install.

## Apply Migrations

```bash
npx @insforge/cli db migrations up --all
```

## Verify

```bash
npx @insforge/cli db query "SELECT table_name FROM information_schema.tables WHERE table_schema='public'"
```

## Tables

- `calls` — one row per Twilio call (call_sid, status, duration, action_count)
- `events` — all realtime events for replay/audit (call_id FK, type, payload jsonb)

## RLS

Both tables have RLS enabled. Service key bypasses RLS for backend writes.
Anon key can read (policy allows all for hackathon — tighten post-demo).
