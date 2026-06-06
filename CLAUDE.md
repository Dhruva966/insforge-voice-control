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

## InsForge SDK — VERIFIED Patterns (Phase 1 complete)

```typescript
// SDK init — VERIFIED: use createAdminClient for backend
import { createAdminClient } from "@insforge/sdk";
const insforge = createAdminClient({ baseUrl: INSFORGE_URL, apiKey: INSFORGE_KEY });

// Database — VERIFIED: insforge.database.from() (not .from() directly)
const result = await insforge.database.from("calls").insert({...});
if (result.error) throw new Error(result.error.message);

// Realtime — VERIFIED: connect + subscribe BEFORE publish
await insforge.realtime.connect();
await insforge.realtime.subscribe("voice-ops");
await insforge.realtime.publish("voice-ops", "call_event", payload);  // 3 args

// ESM note: package.json has "type":"module" + "moduleResolution":"Bundler"
// alawmulaw CJS workaround: use createRequire(import.meta.url)
```

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
npx @insforge/cli db migrations up --all
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
