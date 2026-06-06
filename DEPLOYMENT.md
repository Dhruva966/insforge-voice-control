# Deployment Runbook — Gojo

## Current Live State (2026-06-06)

| Service | URL | Status |
|---------|-----|--------|
| Dashboard (Vercel) | https://web-eta-two-78.vercel.app | ✅ Live |
| Express backend | http://localhost:3000 | ✅ Running |
| ngrok tunnel | https://71f7-136-25-74-62.ngrok-free.app | ✅ Active (ephemeral) |
| Twilio number | +1 (925) 515-5725 | ✅ Wired to ngrok |
| InsForge project | cayxche9.us-east.insforge.app | ✅ Live |

---

## Local Development

```bash
# Terminal 1 — Express server
cd api
npm run dev
# [server] listening on :3000
# [server] voice webhook: https://71f7-136-25-74-62.ngrok-free.app/voice

# Terminal 2 — ngrok (only needed if url expired)
ngrok http 3000
# → copy new URL, then follow "On Every Ngrok Restart" steps below
```

**Access dashboard locally:** `http://localhost:3000` (Express serves public/ directly — no Vercel CLI needed)

---

## On Every Ngrok Restart

ngrok URLs are **ephemeral** and change every restart. Update 4 things:

```bash
# 1. Start ngrok
ngrok http 3000
# Copy: https://xxxx.ngrok-free.app

# 2. Update repo-root .env
TWILIO_WEBHOOK_BASE=https://xxxx.ngrok-free.app

# 3. Twilio console
# console.twilio.com → Phone Numbers → +19255155725 → Voice → Webhook
# POST  https://xxxx.ngrok-free.app/voice

# 4. Vercel env var → redeploy
# vercel.com → project → Settings → Environment Variables → BACKEND_URL = https://xxxx.ngrok-free.app
cd web && npx vercel --prod

# 5. Restart Express (must reload .env — nodemon doesn't watch .env)
pkill -f "nodemon.*server.ts" && pkill -f "tsx.*server.ts"
cd api && npm run dev
```

**Tip for stable demo:** deploy Express to Railway once so `BACKEND_URL` never changes:
```bash
railway login && railway init && railway up
# → static URL, update BACKEND_URL in Vercel once and forget it
```

---

## Vercel Dashboard Deployment

```bash
cd web/
npx vercel --prod
```

Environment variables (set once in Vercel dashboard — persist across deploys):

| Variable | Value | Where |
|----------|-------|-------|
| `INSFORGE_URL` | `https://cayxche9.us-east.insforge.app` | Vercel env |
| `INSFORGE_KEY` | `ik_7bc9c2f414dc7f611599cad0fd7e56fd` | Vercel env (server-only) |
| `BACKEND_URL` | current ngrok URL | Vercel env — update each ngrok restart |

---

## InsForge Setup (one-time)

```bash
npx @insforge/cli login
npx @insforge/cli link

# Run migrations from /db (CLI resolves migrations/ relative to cwd)
cd db
npx @insforge/cli db migrations up --all
cd ..

# Verify
npx @insforge/cli db query "SELECT table_name FROM information_schema.tables WHERE table_schema='public'"
# → voice_calls, events
```

---

## Environment Variables (repo-root .env)

```bash
# Gemini
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.1-flash-live-preview
GEMINI_VOICE=Puck

# Twilio
TWILIO_ACCOUNT_SID=<see .env>
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+19255155725
TWILIO_WEBHOOK_BASE=https://71f7-136-25-74-62.ngrok-free.app   ← update each restart

# InsForge
INSFORGE_URL=https://cayxche9.us-east.insforge.app
INSFORGE_KEY=ik_7bc9c2f414dc7f611599cad0fd7e56fd

# Replicas
REPLICAS_API_KEY=sk_replicas_gdcsQvF13588ctqM-ndfiWN1qY57XXNifv9mEdlD2mk

# Devin
DEVIN_API_KEY=cog_fjqiflstlyca6nkif4nik2wk36x2wetnhyfvdemxu3pgiumm4yfq   ← rotate after hackathon
DEVIN_ORG_ID=org-61ec02a9a3ac437ba2e6f96165679f5d

# Slack (optional)
# SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
# SLACK_SIGNING_SECRET=...

# Server
NODE_ENV=development
PORT=3000
DISABLE_TWILIO_SIGNATURE_VALIDATION=false   ← never set true in production
```

---

## Demo Checklist

- [ ] Express server running: `curl http://localhost:3000/health` → `{"ok":true}`
- [ ] ngrok active: check `http://localhost:4042/api/tunnels`
- [ ] Twilio console webhook = current ngrok `/voice`
- [ ] Vercel `BACKEND_URL` = current ngrok URL
- [ ] Open dashboard: `http://localhost:3000` (local) or `https://web-eta-two-78.vercel.app` (public)
- [ ] Call +19255155725 → hear "InsForge Control online. What do you need?"
- [ ] Say "show me the last five calls" → SQL diff on dashboard
- [ ] Alert button → enter phone → "Call me now" → Gojo calls back

---

## TypeScript Check

```bash
cd api && npm run check   # tsc --noEmit — run before every commit
```
