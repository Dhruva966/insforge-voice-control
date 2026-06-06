# db/ — Database Migrations

InsForge Postgres migrations. Always use `npx @insforge/cli` — never global install.

## Current State (Phase 1 complete)

Tables are LIVE on InsForge project `fy4p4tyq`:
- `voice_calls` — ✅ created + RLS enabled
- `events` — ✅ created + RLS enabled

Note: `calls` table exists from a prior project (cadence-schema — healthcare). Do NOT use it.

## Apply from scratch

The CLI looks for migrations in `migrations/` at project root. To apply our SQL manually:
```bash
npx @insforge/cli db import db/migrations/001_init.sql
# or run individual statements via:
npx @insforge/cli db query "<SQL>"
```

## Verify

```bash
npx @insforge/cli db tables
npx @insforge/cli db query "SELECT column_name FROM information_schema.columns WHERE table_name='voice_calls' ORDER BY ordinal_position" --json
```

## Tables

- `voice_calls` — one row per Twilio call (call_sid, caller_phone, status, action_count, started_at, ended_at)
- `events` — all realtime events for replay/audit (call_id FK → voice_calls, type, payload jsonb)

## RLS

Both tables have RLS enabled. Admin key (`ik_03...`) bypasses RLS for backend writes.
Policies: `service_write_voice_calls` and `service_write_events` — allow all (tighten post-demo).
