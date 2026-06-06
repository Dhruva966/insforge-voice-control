# Handoff Notes — Insforge Voice Control

## Current Status

**Phase:** Phase 1 complete. DB live. Ready for E2E test.

## What's Done

- [x] Full directory structure created
- [x] All markdown + config files generated
- [x] All TypeScript source files implemented (no ⚠️ VERIFY stubs remaining)
- [x] Database migration written (001_init.sql — includes caller_phone column)
- [x] docs/RESEARCH.md populated with all verified API docs
- [x] CLAUDE.md, AGENTS.md, DEPLOYMENT.md written
- [x] InsForge SDK verified: `createAdminClient({ baseUrl, apiKey })` + `insforge.database.from()`
- [x] ESM compatibility fixed: `"type": "module"` + `"moduleResolution": "Bundler"` + alawmulaw via createRequire
- [x] `tsc --noEmit` passes clean
- [x] Server boots: `[server] listening on :3000`
- [x] CLI linked: `npx @insforge/cli link --api-base-url ... --api-key ...`
- [x] Codex security review: 4 bugs fixed (execFileSync, semicolon SQL guard, source allowlist, DB error checking)
- [x] insert([{}]) array shape fixed (InsForge SDK requirement)
- [x] DB tables created on InsForge: `voice_calls` + `events` (renamed from `calls` — conflict with prior cadence-schema project)
- [x] RLS policies applied: `service_write_voice_calls`, `service_write_events`
- [x] sessions.ts updated to use `voice_calls` table

## What Needs to Be Done Next

### Next Steps

1. Start server + ngrok in separate terminals:
```bash
# Terminal 1
cd api && npm run dev

# Terminal 2 (if ngrok needs new URL)
ngrok http 3000
# Then update TWILIO_WEBHOOK_BASE in .env
```

4. Configure Twilio: go to Twilio console → Phone Numbers → +19255155725 → Voice → Webhook → POST → `https://YOUR-NGROK.ngrok.io/voice`

5. Call +19255155725 → should hear "InsForge Control online. What do you need?"

6. Test realtime: watch InsForge console → Realtime tab for `voice-ops` channel events

7. Dashboard: run `cd web && npm install && npx vercel dev --listen 3001`, then open `http://localhost:3001`

8. Deploy web/ to Vercel when working

## Key Risks

1. **Realtime channel name** — "voice-ops" in realtime.ts must match what web/api/events.ts subscribes to; verify in InsForge console after first call
3. **Twilio ngrok URL** — current URL in .env may expire; regenerate if needed
4. **Replicas endpoint** — `/v1/replica` vs `/v1/replicas` — check docs before implementing (stretch goal)

## Env Vars Still Needed

Fill these in `.env` before starting:
```
TWILIO_WEBHOOK_BASE=https://YOUR-NGROK.ngrok.io
INSFORGE_URL=https://YOUR-PROJECT.insforge.app
INSFORGE_KEY=
REPLICAS_API_KEY=
```

## Reference Codebase

Working Twilio + Gemini implementation:
`/tmp/dry-cleaning-deep/` (or clone: https://github.com/gandhiaayush/dry-cleaning-voice-agent)

Key files to reference:
- `src/services/gemini/audioConverter.ts` — copy exactly
- `src/services/gemini/liveSession.ts` — adapt for InsForge tools
- `src/routes/mediaStream.ts` — adapt (remove Supabase, add InsForge)
- `src/middleware/twilioValidate.ts` — copy exactly
