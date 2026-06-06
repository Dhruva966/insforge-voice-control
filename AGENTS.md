# Insforge Voice Control — Codex / Agent Instructions

This file mirrors CLAUDE.md for Codex and other coding agents.

## Project

Twilio voice call → Gemini Live voice AI → InsForge infra actions → Vercel dashboard.

## Critical Rules

1. Never guess CLI syntax. Check `docs/RESEARCH.md` first.
2. Run `tsc --noEmit` before every commit.
3. Never assume InsForge SDK API surface — verify with `Object.keys(require("@insforge/sdk"))`.
4. InsForge is NOT Supabase. Do not import `@supabase/supabase-js`.
5. Always use `npx @insforge/cli` — never global install.
6. `runSqlQuery` must reject any SQL that doesn't start with SELECT.

## Key File Locations

```
api/src/server.ts               ← Express + WebSocketServer entry point
api/src/config.ts               ← Zod env validation (exits process on bad env)
api/src/routes/voice.ts         ← POST /voice Twilio webhook
api/src/routes/mediaStream.ts   ← WS /media-stream audio bridge
api/src/services/gemini/        ← Gemini Live session, audio codec, tools
api/src/services/insforge/      ← InsForge SDK client, sessions, realtime, actions
api/src/services/replicas/      ← Replicas coding agent (stretch)
web/public/index.html           ← Single-file dashboard
web/api/events.ts               ← SSE relay Vercel function
db/migrations/001_init.sql      ← calls + events tables
docs/RESEARCH.md                ← ALL verified API docs — read before coding
```

## Audio Pipeline

```
Twilio mulaw 8kHz → twilioToGemini() → PCM16 16kHz → Gemini Live
Gemini PCM16 24kHz → geminiToTwilio() → mulaw 8kHz → Twilio
```

## Twilio WebSocket Events (in order)

1. `connected` — fires first, ignore
2. `start` — `frame.start.callSid`, `frame.start.streamSid`, `frame.start.mediaFormat`
3. `media` — `frame.media.payload` (base64 mulaw)
4. `stop` — finalize and close

## InsForge Realtime

```typescript
// Backend publish (verify 3-arg signature at hackathon)
insforge.realtime.publish("voice-ops", "call_event", eventPayload);

// Frontend receives these through the Vercel SSE relay at /api/events
// which subscribes server-side, then forwards the payload to EventSource.
```

## Env Vars Required

```
GEMINI_API_KEY, GEMINI_MODEL, GEMINI_VOICE
TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, TWILIO_WEBHOOK_BASE
INSFORGE_URL, INSFORGE_KEY
REPLICAS_API_KEY
NODE_ENV, PORT
```

## Test Command

```bash
cd api && npm run check   # tsc --noEmit — must be clean before committing
```

<!-- INSFORGE:START -->
## InsForge backend

This project uses [InsForge](https://insforge.dev): an all-in-one, open-source Postgres-based backend (BaaS) that gives this app a database, authentication, file storage, edge functions, realtime, an AI model gateway, and payments through one platform.

- **Project:** **oss-project** (API base `https://fy4p4tyq.us-east.insforge.app`)
- **Skills:** these InsForge skills are installed for supported coding agents. Reach for them before implementing any InsForge feature instead of guessing the API:
  - `insforge`: app code with the `@insforge/sdk` client (database CRUD, auth, storage, edge functions, realtime, AI, email, and Stripe payments).
  - `insforge-cli`: backend and infrastructure via the `insforge` CLI (projects, SQL, migrations, RLS policies, storage buckets, functions, secrets, payment setup, schedules, deploys).
  - `insforge-debug`: diagnosing failures (SDK/HTTP errors, RLS denials, auth and OAuth issues) and running security or performance audits.
  - `insforge-integrations`: wiring external auth providers (Clerk, Auth0, WorkOS, Better Auth, etc.) for JWT-based RLS, or the OKX x402 payment facilitator.
  - `find-skills`: discovering additional skills on demand.
- **Credentials:** app code reads keys from `.env.local`; the CLI reads `.insforge/project.json`. Never hardcode or commit keys.

Key patterns:

- Database inserts take an array: `insert([{ ... }])`.
- Reference users with `auth.users(id)`; use `auth.uid()` in RLS policies.
- For storage uploads, persist both the returned `url` and `key`.
<!-- INSFORGE:END -->
