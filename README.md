# Insforge Voice Control

**InsForge Hackathon** — Solo build, ~6 hours.

Call a Twilio number. Talk to a Gemini Flash voice agent. Watch your InsForge infrastructure change in real time on a live dashboard.

## Architecture

```
Caller → Twilio (+19255155725)
       → POST /voice → TwiML <Connect><Stream>
       → WebSocket /media-stream
       → Gemini Live API (gemini-3.1-flash-live-preview)
       → Tool calls → InsForge SDK (SQL, indexes, logs, edge functions)
       → InsForge Realtime "voice-ops" channel
       → Vercel SSE /api/events
       → Dashboard (live diff viewer, exec log, call status)
```

## Sponsors

| Sponsor | Role |
|---------|------|
| InsForge | Postgres + Realtime bus + Edge Functions + the infra being managed |
| Twilio | Inbound voice call |
| Vercel | Dashboard frontend |
| Replicas | Code change coding agents (stretch) |

## Quick Start

```bash
# 1. Set env vars in .env
# 2. Start API
cd api && npm install && npm run dev

# 3. Expose via ngrok
ngrok http 3000
# Set TWILIO_WEBHOOK_BASE in .env

# 4. Open dashboard locally
open web/public/index.html

# 5. Call +19255155725
```

## Demo Script

1. Dashboard open → "Waiting for call..."
2. Call the number → hear "InsForge Control online. What do you need?"
3. Say "Run a query — show me the last five calls"
4. Watch SQL diff appear on dashboard
5. Say "Add an index on the calls table, column call\_sid"
6. Watch migration diff + exec log update
7. Say "Check the InsForge logs"
8. Hang up → "Call ended — 3 actions" shown

## Agents / Tools

The voice agent can execute 5 InsForge infra actions:

- `run_sql` — read-only SQL queries on InsForge Postgres
- `add_index` — CREATE INDEX migration via InsForge DB
- `deploy_edge_fn` — deploy/update InsForge edge function
- `get_logs` — read InsForge or function logs
- `check_storage` — list storage buckets

## Reference

Architecture adapted from: https://github.com/gandhiaayush/dry-cleaning-voice-agent
