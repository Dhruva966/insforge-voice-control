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

// Frontend subscribe (verify event name at hackathon)
insforge.realtime.on("call_event", (data) => { ... });
```

## Env Vars Required

```
GEMINI_API_KEY, GEMINI_MODEL, GEMINI_VOICE
TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, TWILIO_WEBHOOK_BASE
INSFORGE_URL, INSFORGE_ANON_KEY, INSFORGE_SERVICE_KEY
REPLICAS_API_KEY
NODE_ENV, PORT
```

## Test Command

```bash
cd api && npm run check   # tsc --noEmit — must be clean before committing
```
