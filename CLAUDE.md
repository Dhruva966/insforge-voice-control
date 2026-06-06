# Insforge Voice Control — Root Agent Instructions

## Project Overview

This is a hackathon voice agent that lets callers dial a Twilio number (+19255155725),
speak commands to a Gemini Flash voice AI, and watch InsForge infrastructure change in
real time on a Vercel-deployed dashboard.

**Reference implementation:** https://github.com/gandhiaayush/dry-cleaning-voice-agent
Architecture mirrors that project exactly — Notion/Supabase replaced with InsForge.

## Critical Rules (session-failure prevention)

1. **Never guess CLI syntax.** Always run `--help` or check `docs/RESEARCH.md` first.
   Do not trial-and-error flags. This has burned sessions before.
2. **Run `tsc --noEmit` before committing.** Parallel agents break TypeScript signatures.
3. **Never assume project names or config keys.** Verify with `npx @insforge/cli current`.
4. **Always write HANDOFF.md before long autonomous tasks.** Token limits will cut you off.
5. **Parallel agents need CONTRACTS.md first.** Define shared interfaces before spawning.
6. **InsForge SDK API surface — VERIFY at hackathon start.** See `docs/RESEARCH.md`.

## Tech Stack

| Layer | Package | Version |
|-------|---------|---------|
| Voice webhook | `twilio` | `^5.5.1` |
| Voice AI | `@google/genai` | `^2.3.0` |
| Gemini model | `gemini-3.1-flash-live-preview` | confirmed |
| Audio codec | `alawmulaw` | `^6.0.0` |
| WebSocket | `ws` | `^8.20.1` |
| HTTP server | `express` | `^4.21.2` |
| InsForge SDK | `@insforge/sdk` | latest |
| InsForge CLI | `npx @insforge/cli` | NEVER global install |
| Env validation | `zod` | `^3.23.8` |
| TypeScript runner | `tsx` | `^4.20.6` |

## Directory Map

```
api/        ← Voice agent backend (Node.js/Express/WS)
web/        ← Dashboard (vanilla HTML, Vercel static + SSE function)
db/         ← InsForge Postgres migrations
docs/       ← Research and deep docs (RESEARCH.md = source of truth)
```

## Deep Research Reference

All verified API documentation, CLI syntax, and code patterns are in:
**`docs/RESEARCH.md`** — Read this before writing any InsForge, Twilio, or Gemini code.

## InsForge SDK — VERIFIED Patterns (Phase 2 complete)

**⚠️ REALTIME BUG: `@insforge/sdk` passes `ik_...` admin key as JWT `token` in socket auth.**
**This causes "Invalid token" connection errors. DO NOT use `insforge.realtime` from the SDK.**
**Use raw `socket.io-client` with `auth: { apiKey }` instead (verified working).**

```typescript
// Database — VERIFIED: insforge.database.from() (not .from() directly)
import { createAdminClient } from "@insforge/sdk";
const insforge = createAdminClient({ baseUrl: INSFORGE_URL, apiKey: INSFORGE_KEY });
const result = await insforge.database.from("voice_calls").insert([{...}]);
if (result.error) throw new Error(result.error.message);

// Realtime — BROKEN in SDK. Use raw socket.io instead:
import { io } from "socket.io-client";
const socket = io(INSFORGE_URL, { transports: ["websocket"], auth: { apiKey: INSFORGE_KEY } });
// Must subscribe BEFORE publish:
socket.emit("realtime:subscribe", { channel: "voice-ops" }, (res) => { /* check res.ok */ });
// Publish:
socket.emit("realtime:publish", { channel: "voice-ops", event: "call_event", payload });
// Receive:
socket.on("call_event", (message) => { /* message includes .meta from server */ });

// PREREQUISITE: voice-ops channel must exist on the project.
// Create once via: POST /api/realtime/channels { pattern: "voice-ops", enabled: true }
// Authorization: Bearer ik_...

// ESM note: package.json has "type":"module" + "moduleResolution":"Bundler"
// alawmulaw CJS workaround: use createRequire(import.meta.url)
```

**Current InsForge project:** `cayxche9.us-east.insforge.app` (switched from `fy4p4tyq`)
**DB tables:** `voice_calls` + `events` (created 2026-06-06, RLS enabled)
**Dashboard (Vercel):** `https://web-eta-two-78.vercel.app`
**Devin:** `DEVIN_ORG_ID=org-61ec02a9a3ac437ba2e6f96165679f5d`, target repo `Dhruva966/gojo-mock-api`

## ngrok / Server Restart Protocol

⚠️ Nodemon does NOT watch `.env`. After any `.env` change (e.g. new ngrok URL), restart server:
```bash
pkill -f "nodemon.*server.ts" && pkill -f "tsx.*server.ts"
cd api && npm run dev
```

On every ngrok restart, update all 4 locations: `.env` `TWILIO_WEBHOOK_BASE`, Twilio console webhook, Vercel `BACKEND_URL` env var + redeploy (`cd web && npx vercel --prod`).

## Twilio Media Streams — Key Facts

- TwiML must use `<Connect>` (NOT `<Start>`) for bidirectional audio
- WebSocket sends a `connected` event BEFORE `start` — handle both
- `mediaFormat` is nested under `start.mediaFormat` (NOT top-level)
- Audio format: mulaw 8kHz, 160 bytes/frame, 20ms/frame
- Send `{event:"clear", streamSid}` when tool call fires (barge-in)

## Gemini Live API — Key Facts

- Model: `gemini-3.1-flash-live-preview`
- SDK: `@google/genai` v2.3.0+
- Audio in: `sendRealtimeInput({audio: {data, mimeType: "audio/pcm;rate=16000"}})`
- Audio out: `msg.data` (base64 PCM16 24kHz) in `onmessage` callback
- Tool call: `msg.toolCall.functionCalls[]` in `onmessage` callback
- Tool response: `liveSession.sendToolResponse({functionResponses: [...]})`

## InsForge CLI — ALWAYS use npx

```bash
npx @insforge/cli login
npx @insforge/cli link
npx @insforge/cli current
npx @insforge/cli db query "SELECT 1"
cd db && npx @insforge/cli db migrations up --all
npx @insforge/cli functions deploy slug --file ./fn.ts
npx @insforge/cli logs insforge.logs
npx @insforge/cli logs function.logs --json
```

## 6-Hour Build Order

1. (0:00–0:30) InsForge setup: login, link, verify SDK, run migrations
2. (0:30–1:30) Port voice pipeline from dry-cleaning reference
3. (1:30–2:30) InsForge client, sessions, realtime
4. (2:30–3:30) 5 agent actions + Gemini tool declarations
5. (3:30–4:00) Wire Gemini → broadcast realtime events
6. (4:00–5:00) Dashboard HTML + SSE relay
7. (5:00–5:30) E2E test: call → dashboard updates
8. (5:30–6:00) Deploy web/ to Vercel
9. (Stretch) Replicas coding agent integration
