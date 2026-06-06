# Handoff Notes — Gojo (InsForge Voice Control)

## Current Status (2026-06-06)

**Phase:** Demo-ready. All core flows working. Alert flow + Devin integration + Slack wired.

---

## What's Done

### Infrastructure
- [x] InsForge project: `cayxche9.us-east.insforge.app`
- [x] DB tables: `voice_calls` + `events` with RLS enabled
- [x] InsForge Realtime `voice-ops` channel created
- [x] Vercel dashboard deployed + SSE relay wired
- [x] ngrok running: `https://71f7-136-25-74-62.ngrok-free.app`

### Voice Pipeline
- [x] Twilio Media Streams → Gemini Live → InsForge tools → Realtime broadcast
- [x] 11 tools across 6 sponsors (InsForge, Twilio, Gemini, Vercel, Replicas, Devin)
- [x] Twilio signature validation (middleware/twilioValidate.ts)
- [x] Stream token auth on `/media-stream` WebSocket
- [x] Early audio buffering until Gemini ready
- [x] 250ms silence window for faster turn detection
- [x] Non-blocking async for CLI actions + realtime publish

### Alert Flow (full end-to-end)
- [x] Mock error button on dashboard → phone input modal → POST /api/alert/trigger
- [x] Vercel proxy function (`web/api/alert/trigger.ts`) → Express alertRouter
- [x] Express creates outbound Twilio call with alert context in TwiML `<Parameter>`
- [x] mediaStream reads `alertId` → `consumeAlert()` → `openGeminiSession(alertCtx)`
- [x] Terse alert greeting: "Hey, Gojo here — there's a [ErrorType] in [file]..."
- [x] User says "fix it" → Gemini calls `spawn_devin_agent`

### Devin Integration
- [x] Devin API v3 client (`api/src/services/devin/client.ts`)
- [x] Transcript router (`api/src/services/devin/router.ts`) — Gemini Flash routes voice to Devin
- [x] `DEVIN_ORG_ID` set: `org-61ec02a9a3ac437ba2e6f96165679f5d`
- [x] Mock repo: `Dhruva966/gojo-mock-api` (Express+TS, users/posts CRUD, JWT, pg pool)

### Dashboard (dark violet, Vercel-deployed)
- [x] Gojo splash screen (4.8s + 0.9s fade) with orbiting sponsor logos
- [x] 4-panel layout: left sidebar + main diff viewer + agents tab + right transcript
- [x] Multi-agent grid: spawn animation, status rings, narration, Prism.js code highlight
- [x] Gojo SVG logo in each agent card header (top-left) with side-to-side bob animation
- [x] Click agent card → Devin detail modal (status, diff, session link, PR link)
- [x] Agent tab empty state: Gojo SVG idle, no robot emoji
- [x] JSON diff fallback: auto-detects JSON payload and pretty-prints with syntax highlight
- [x] Alert modal: phone input → "Call me now" button (no emojis)
- [x] Realtime SSE connection with auto-reconnect
- [x] Call-ended banner: prominent red bar + duration + action count
- [x] Summary tab: auto-shown on call end, stats + action list + agent cards
- [x] Zero emojis anywhere on the site
- [x] Lighter violet accent (#8b5cf6), grayish dark background (#0c0c14)
- [x] Transcript accumulation fix: buffers chunks, emits on `finished:true`

### Slack
- [x] Incoming Webhook: raw `fetch()` + Block Kit JSON
- [x] Slash command (`/gojo`): HMAC-SHA256 signature verification
- [x] `SLACK_SIGNING_SECRET` required for slash commands

### Code Quality
- [x] `tsc --noEmit` passes clean (as of last commit)
- [x] Codex security review: execFileSync, SQL guard, source allowlist, DB error checking
- [x] ESM-compatible: `"type":"module"` + `alawmulaw` via `createRequire`

---

## Active Session State

```
ngrok URL:            https://71f7-136-25-74-62.ngrok-free.app   ← EPHEMERAL, changes on restart
TWILIO_WEBHOOK_BASE:  https://71f7-136-25-74-62.ngrok-free.app   ← set in .env
Twilio console:       webhook = https://71f7-136-25-74-62.ngrok-free.app/voice
Vercel BACKEND_URL:   https://71f7-136-25-74-62.ngrok-free.app   ← set in Vercel env vars
Express server:       running on :3000 (via npm run dev in api/)
ngrok process:        running in background (started by Claude)
```

---

## On Every Ngrok Restart

ngrok URLs are ephemeral. Each restart requires updating 3 places:

```bash
# 1. Start ngrok
ngrok http 3000
# → copy NEW_URL

# 2. Update .env
TWILIO_WEBHOOK_BASE=NEW_URL

# 3. Update Twilio console
# console.twilio.com → Phone Numbers → +19255155725 → Voice → Webhook = NEW_URL/voice

# 4. Update Vercel env + redeploy
# Vercel dashboard → Environment Variables → BACKEND_URL = NEW_URL
cd web && npx vercel --prod

# 5. Restart Express server (to pick up new .env)
# Kill old: pkill -f "nodemon.*server.ts" && pkill -f "tsx.*server.ts"
cd api && npm run dev
```

**Tip:** Deploy Express to Railway for a stable URL that doesn't change:
```bash
railway login && railway init && railway up
```

---

## Remaining Work

1. **(Optional)** Deploy Express to Railway/Render for stable non-ephemeral `BACKEND_URL`
2. **(Optional)** `SLACK_WEBHOOK_URL` + `SLACK_SIGNING_SECRET` in `.env` for Slack features
3. **(Optional)** Rotate Devin API key after hackathon (currently in .env)
4. **(Verify)** Deploy updated `web/public/index.html` to Vercel: `cd web && npx vercel --prod`

---

## Key Technical Notes

- **InsForge SDK realtime bug**: `@insforge/sdk` passes `ik_...` key as JWT → "Invalid token". Use raw `socket.io-client` with `auth: { apiKey }` everywhere. This is already fixed in `realtime.ts`.
- **Server .env loading**: server reads `../.env` (repo root). Must restart server after `.env` changes — nodemon only watches `.ts`/`.json`, not `.env`.
- **Multiple nodemon instances**: if port 3000 is already in use, kill all with `pkill -f "nodemon.*server.ts" && pkill -f "tsx.*server.ts"` before restarting.
- **Dashboard local vs Vercel**: Express serves dashboard at `localhost:3000` directly (no Vercel needed for local). Alert button hits Express `/api/alert/trigger` natively. Only use Vercel URL for judges/remote access.
- **Vercel function**: `web/api/alert/trigger.ts` proxies to `BACKEND_URL`. `web/api/events.ts` subscribes to InsForge Realtime and SSE-streams to browser. `maxDuration: 300` required in vercel.json.
