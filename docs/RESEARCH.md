# Deep Research — Insforge Voice Control

**Source of truth for all verified API docs, CLI syntax, and code patterns.**
Read this before writing any InsForge, Twilio, Gemini, or Replicas code.

Generated from: deep parallel research + dry-cleaning reference repo analysis + Codex review.
Last updated: 2026-06-06.

---

## Table of Contents

1. [InsForge SDK](#1-insforge-sdk)
2. [InsForge Realtime](#2-insforge-realtime)
3. [InsForge CLI](#3-insforge-cli)
4. [Gemini Live API](#4-gemini-live-api)
5. [Audio Codec — mulaw ↔ PCM16](#5-audio-codec--mulaw--pcm16)
6. [Twilio Media Streams](#6-twilio-media-streams)
7. [Replicas API](#7-replicas-api)
8. [Vercel Serverless Functions](#8-vercel-serverless-functions)
9. [Known Failure Modes](#9-known-failure-modes)

---

## 1. InsForge SDK

### Package

```bash
npm install @insforge/sdk
```

### ✅ VERIFIED — SDK init pattern (Phase 1)

```bash
# SDK exports confirmed (v1.3.1):
# createClient, createAdminClient, InsForgeClient, AI, Auth, Database,
# Emails, Functions, HttpClient, InsForgeError, Logger, Payments,
# Realtime, Storage, StorageBucket, TokenManager, default

# Backend uses createAdminClient:
import { createAdminClient } from "@insforge/sdk";
const insforge = createAdminClient({
  baseUrl: process.env.INSFORGE_URL!,   // https://fy4p4tyq.us-east.insforge.app
  apiKey: process.env.INSFORGE_KEY!,    // ik_03... (project key)
});
```

**DO NOT** use `createClient` for the backend — that's the browser/anon client.
`createAdminClient` bypasses RLS and uses the admin/service key.

### ✅ VERIFIED — Database API (Phase 1)

```typescript
// Shape B is correct: insforge.database.from("table")
insforge.database.from("calls").insert({...})
insforge.database.from("calls").select("*").eq("call_sid", id)
insforge.database.from("calls").update({...}).eq("call_sid", id)

// Returns { data, error } — always check error before proceeding
const result = await insforge.database.from("calls").insert({...});
if (result.error) throw new Error(result.error.message);
```

### Environment Variables

```
INSFORGE_URL=https://your-project.us-east.insforge.app
INSFORGE_KEY=...           # backend/admin key
```

### Key Difference vs Supabase

**InsForge is NOT Supabase.** Do NOT import `@supabase/supabase-js`.
The API surface differs. Channels are Socket.IO (not Supabase channels).
RLS is supported but configured differently.

---

## 2. InsForge Realtime

### ✅ VERIFIED — Realtime API (Phase 1)

InsForge Realtime uses **Socket.IO channels**, NOT Supabase channels.

```typescript
// Backend: MUST connect + subscribe before publish
await insforge.realtime.connect();
await insforge.realtime.subscribe("voice-ops");   // ← required before publish
// 3-arg publish confirmed:
insforge.realtime.publish("voice-ops", "call_event", payload);

// Frontend / SSE relay: subscribe + listen
await insforge.realtime.connect();
await insforge.realtime.subscribe("voice-ops");
// ⚠️ verify event name: "call_event" — must match what backend publishes
insforge.realtime.on("call_event", (data) => { /* handle */ });
```

### Verification test

Before hooking up the dashboard, broadcast a test event from the API:
```typescript
await insforge.realtime.connect();
insforge.realtime.publish("voice-ops", "call_event", { type: "test", ts: Date.now() });
// Then subscribe in a separate process and confirm receipt
```

Check InsForge project console → Realtime section for received events.

---

## 3. InsForge CLI

### ⚠️ ALWAYS use npx — NEVER install globally

```bash
# Auth
npx @insforge/cli login
npx @insforge/cli link         # link to your project
npx @insforge/cli current      # verify linked project

# Database
npx @insforge/cli db query "SELECT 1"
npx @insforge/cli db query "SELECT * FROM calls LIMIT 5" --json
npx @insforge/cli db migrations new migration_name
npx @insforge/cli db migrations up --all
npx @insforge/cli db migrations status

# Edge Functions
npx @insforge/cli functions deploy my-fn --file ./handler.ts
npx @insforge/cli functions invoke my-fn --data '{"key":"val"}'
npx @insforge/cli functions list

# Logs
npx @insforge/cli logs insforge.logs
npx @insforge/cli logs insforge.logs --limit 20 --json
npx @insforge/cli logs function.logs --json

# Storage
npx @insforge/cli storage list
npx @insforge/cli storage list --json

# Debug
npx @insforge/cli diagnose
npx @insforge/cli --help
npx @insforge/cli db --help
```

### Running from code (actions.ts)

```typescript
import { execSync } from "child_process";

const output = execSync(
  `npx @insforge/cli db query ${JSON.stringify(sql)} --json`,
  { encoding: "utf8", timeout: 15000 }
);
const rows = JSON.parse(output);
```

**Security:** Always deny non-SELECT SQL when exposing to voice agent:
```typescript
if (!sql.trim().toLowerCase().startsWith("select")) {
  throw new Error("Security: only SELECT queries allowed");
}
```

---

## 4. Gemini Live API

### Package

```bash
npm install @google/genai@^2.3.0
```

### Model string (confirmed)

```
gemini-3.1-flash-live-preview
```

User confirmed. Also verified in dry-cleaning reference repo (`/tmp/dry-cleaning-deep/src/config.ts`).

### Session open (EXACT — verified from working reference)

```typescript
import { GoogleGenAI, Modality, StartSensitivity, EndSensitivity } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const liveSession = await ai.live.connect({
  model: "gemini-3.1-flash-live-preview",
  config: {
    responseModalities: [Modality.AUDIO],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    temperature: 0,
    speechConfig: {
      voiceConfig: {
        prebuiltVoiceConfig: { voiceName: "Puck" },  // or "Aoede", "Charon", "Fenrir", "Kore"
      },
      languageCode: "en-US",
    },
    tools: [{ functionDeclarations: INSFORGE_TOOLS }],
    realtimeInputConfig: {
      automaticActivityDetection: {
        disabled: false,
        startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_LOW,
        endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
        silenceDurationMs: 700,
      },
    },
    inputAudioTranscription: {},   // enables caller transcript in msg.serverContent
    outputAudioTranscription: {},  // enables agent transcript
  },
  callbacks: {
    onmessage: async (msg) => {
      // Audio response
      if (msg.data) {
        onAudio(geminiToTwilio(msg.data));  // msg.data = base64 PCM16 24kHz
      }
      // Agent transcript
      if (msg.serverContent?.outputTranscription?.text) {
        console.log("[agent]", msg.serverContent.outputTranscription.text);
      }
      // Tool call
      if (msg.toolCall?.functionCalls?.length) {
        for (const call of msg.toolCall.functionCalls) {
          const { name, args, id } = call;
          // execute tool...
          liveSession.sendToolResponse({
            functionResponses: [{ id, name, response: { output: result } }],
          });
        }
      }
    },
    onerror: (err) => console.error("Gemini error:", err),
    onclose: () => console.log("Gemini session closed"),
  },
});

// Send audio
liveSession.sendRealtimeInput({
  audio: { data: twilioToGemini(base64Mulaw), mimeType: "audio/pcm;rate=16000" },
});

// Send text (opening cue)
liveSession.sendRealtimeInput({ text: "[Call connected. Say: 'InsForge Control online.']" });

// Send tool response
liveSession.sendToolResponse({ functionResponses: [{ id, name, response: { output: result } }] });

// Close
liveSession.close();
```

### Audio formats

| Direction | Format |
|-----------|--------|
| Twilio → Gemini | mulaw 8kHz → PCM16 16kHz (convert with `twilioToGemini()`) |
| Gemini → Twilio | PCM16 24kHz → mulaw 8kHz (convert with `geminiToTwilio()`) |

### Tool declaration shape

```typescript
import type { FunctionDeclaration } from "@google/genai";

const tool: FunctionDeclaration = {
  name: "run_sql",
  description: "Execute a read-only SQL SELECT query",
  parameters: {
    type: "object" as const,
    properties: {
      sql: { type: "string" as const, description: "The SQL SELECT query" },
    },
    required: ["sql"],
  },
};
```

Pass to session config as: `tools: [{ functionDeclarations: [tool1, tool2, ...] }]`

### Voice names (verified available)

`Puck`, `Aoede`, `Charon`, `Fenrir`, `Kore`

---

## 5. Audio Codec — mulaw ↔ PCM16

### Package

```bash
npm install alawmulaw@^6.0.0
```

### Complete implementation (copy exactly — verified working)

Source: `/tmp/dry-cleaning-deep/src/services/gemini/audioConverter.ts`

```typescript
import { mulaw } from "alawmulaw";

function upsample(samples: Int16Array, fromRate: number, toRate: number): Int16Array {
  const ratio = toRate / fromRate;
  const output = new Int16Array(Math.floor(samples.length * ratio));
  for (let i = 0; i < output.length; i++) {
    const srcIdx = i / ratio;
    const lo = Math.floor(srcIdx);
    const hi = Math.min(lo + 1, samples.length - 1);
    const frac = srcIdx - lo;
    output[i] = Math.round(samples[lo] * (1 - frac) + samples[hi] * frac);
  }
  return output;
}

function downsample(samples: Int16Array, fromRate: number, toRate: number): Int16Array {
  const ratio = fromRate / toRate;
  const output = new Int16Array(Math.floor(samples.length / ratio));
  for (let i = 0; i < output.length; i++) {
    output[i] = samples[Math.round(i * ratio)];
  }
  return output;
}

// Twilio mulaw 8kHz → Gemini PCM16 16kHz
export function twilioToGemini(base64Mulaw: string): string {
  const mulawBytes = new Uint8Array(Buffer.from(base64Mulaw, "base64"));
  const pcm8k = mulaw.decode(mulawBytes);
  const pcm16k = upsample(pcm8k, 8000, 16000);
  return Buffer.from(pcm16k.buffer).toString("base64");
}

// Gemini PCM16 24kHz → Twilio mulaw 8kHz
export function geminiToTwilio(base64Pcm24k: string): string {
  const raw = Buffer.from(base64Pcm24k, "base64");
  const pcm24k = new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2);
  const pcm16k = downsample(pcm24k, 24000, 16000);
  const pcm8k = downsample(pcm16k, 16000, 8000);
  const mulawBytes = mulaw.encode(pcm8k);
  return Buffer.from(mulawBytes).toString("base64");
}
```

### Frame sizes

- Twilio sends: 160 bytes mulaw = 20ms frame at 8kHz (verified from reference repo ADR-006)
- Rate: 50 frames/second
- No buffering needed for hackathon — send each frame directly to Gemini

---

## 6. Twilio Media Streams

### TwiML — MUST use `<Connect>` not `<Start>`

```xml
<Response>
  <Connect>
    <Stream url="wss://your-server.com/media-stream" />
  </Connect>
</Response>
```

`<Connect>` = bidirectional (required for sending audio back to caller).
`<Start>` = one-directional only (server only receives, can't send audio).

### Node.js TwiML builder

```typescript
import twilio from "twilio";
const VoiceResponse = twilio.twiml.VoiceResponse;

function buildStreamTwiml(): string {
  const twiml = new VoiceResponse();
  const connect = twiml.connect();
  const wsUrl = TWILIO_WEBHOOK_BASE
    .replace(/^https:\/\//, "wss://")
    .replace(/^http:\/\//, "ws://");
  connect.stream({ url: `${wsUrl}/media-stream` });
  return twiml.toString();
}
```

### WebSocket message shapes (Codex-verified)

```typescript
// 1. connected — fires FIRST before start, log and ignore
{ event: "connected", protocol: "Call" }

// 2. start — mediaFormat NESTED under start.* (not top-level)
{
  event: "start",
  start: {
    callSid: "CA...",
    streamSid: "MZ...",
    mediaFormat: { encoding: "audio/x-mulaw", sampleRate: 8000, channels: 1 },
  }
}

// 3. media (Twilio → server, audio in) — 20ms frames, 160 mulaw bytes base64
{ event: "media", streamSid: "MZ...", media: { payload: "<base64mulaw>" } }

// 4. stop
{ event: "stop", stop: { callSid: "CA..." } }

// Server → Twilio (audio out)
{ event: "media", streamSid: "MZ...", media: { payload: "<base64mulaw>" } }

// Clear buffered audio (barge-in — send when tool call starts)
{ event: "clear", streamSid: "MZ..." }
```

### Barge-in pattern

When Gemini fires a tool call (`msg.toolCall`), send `clear` immediately before executing:
```typescript
ws.send(JSON.stringify({ event: "clear", streamSid }));
```

### Signature validation

```typescript
import twilio from "twilio";

const valid = twilio.validateRequest(
  TWILIO_AUTH_TOKEN,
  req.headers["x-twilio-signature"] as string,
  `${TWILIO_WEBHOOK_BASE}${req.originalUrl}`,  // full URL including path
  req.body as Record<string, string>            // form-encoded body (NOT JSON)
);
if (!valid) { res.status(403).send("Forbidden"); return; }
```

Skip in `NODE_ENV === "development"`.

Body must be parsed as `urlencoded` (not JSON):
```typescript
app.use(bodyParser.urlencoded({ extended: false }));
```

### ngrok setup for local dev

```bash
ngrok http 3000
# Copy https URL → set TWILIO_WEBHOOK_BASE
# Twilio console → Phone Numbers → +19255155725 → Voice → POST → https://xxx.ngrok.io/voice
```

---

## 7. Replicas API

### ⚠️ STRETCH GOAL — verify before implementing

Check https://docs.tryreplicas.com at hackathon start for exact endpoint paths.
DO NOT trial-and-error the API.

### Suspected endpoints (unconfirmed)

```
POST /v1/replica       (singular — Codex flagged plural /v1/replicas may be wrong)
GET  /v1/replicas/{id} (poll for status)
```

### Auth

```
Authorization: Bearer <REPLICAS_API_KEY>
Content-Type: application/json
```

### Suspected request body

```json
{
  "message": "Write a function that...",
  "coding_agent": "claude",
  "repository": "owner/repo"
}
```

### Response

```json
{ "id": "<agent-id>" }
```

Poll `GET /v1/replicas/{id}` until `status === "completed"`. Then get diff and files.

---

## 8. Vercel Serverless Functions

### SSE function — MUST set maxDuration

Default function timeout is 10s — SSE connections drop without `maxDuration`.

```json
// web/vercel.json
{
  "buildCommand": "echo static",
  "outputDirectory": "public",
  "functions": {
    "api/events.ts": {
      "runtime": "nodejs22.x",
      "maxDuration": 300
    }
  }
}
```

### SSE response pattern

```typescript
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: Request): Promise<Response> {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // ... subscribe to InsForge Realtime ...
      // Forward events:
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      // Heartbeat every 25s:
      const hb = setInterval(() => {
        controller.enqueue(encoder.encode(": heartbeat\n\n"));
      }, 25000);
      // Cleanup on disconnect:
      req.signal.addEventListener("abort", () => {
        clearInterval(hb);
        controller.close();
      });
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

### Deploy

```bash
npm i -g vercel
vercel login
cd web/
npm install
vercel link
vercel env add INSFORGE_URL
vercel env add INSFORGE_KEY
vercel --prod
```

### NEXT_PUBLIC_* env vars DO NOT work in static HTML

Static HTML files cannot access `NEXT_PUBLIC_*` vars. The dashboard (`index.html`)
connects to `/api/events` (relative path) — the SSE function handles InsForge auth
server-side. No env vars leak to browser.

---

## 9. Known Failure Modes

These burned real time in prior Claude Code sessions:

| Failure | Root Cause | Fix |
|---------|-----------|-----|
| InsForge SDK init fails | Wrong pattern (A vs B) | Run `Object.keys(require("@insforge/sdk"))` at start |
| Realtime events not received | Wrong event name in `.on()` | Must match what `.publish()` sends |
| Dashboard SSE drops at 10s | Missing `maxDuration` in vercel.json | Add `"maxDuration": 300` |
| Audio choppy / no audio | `<Start>` TwiML instead of `<Connect>` | Must use `<Connect>` for bidirectional |
| Twilio webhook 403 | Signature validation fails on URL mismatch | Full URL = `TWILIO_WEBHOOK_BASE + req.originalUrl` |
| `mediaFormat` undefined | Reading `frame.mediaFormat` not `frame.start.mediaFormat` | Nested under `start.*` |
| Tool call audio glitch | No `clear` event before tool execution | Send `{event:"clear", streamSid}` on tool call |
| SQL injection via voice | No SELECT-only guard | `if (!sql.startsWith("select")) throw` |
| TypeScript errors on commit | `@types/express ^5.0.6` + Express 4 | Pin to `@types/express ^4.17.21` |
| Replicas wrong endpoint | `/v1/replicas` vs `/v1/replica` | Check docs.tryreplicas.com before writing |
| CLI fails | Using globally installed @insforge/cli | ALWAYS use `npx @insforge/cli` |
| Body parsing for Twilio | JSON parser on urlencoded body | Use `bodyParser.urlencoded({extended:false})` |
