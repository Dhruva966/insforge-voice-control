# Handoff Notes — Insforge Voice Control

## Current Status

**Phase:** Scaffolding complete. Ready for Phase 1 implementation.

## What's Done

- [x] Full directory structure created
- [x] All markdown + config files generated
- [x] All TypeScript source file skeletons generated
- [x] Database migration written
- [x] docs/RESEARCH.md populated with all verified API docs
- [x] CLAUDE.md, AGENTS.md, DEPLOYMENT.md written
- [x] Plan reviewed by Codex (14 P1 issues found and fixed)

## What Needs to Be Done in Phase 1

### Hour 0 — InsForge SDK Discovery (FIRST THING)

Before writing any InsForge code, run:
```bash
cd api && npm install
node -e "const m=require('@insforge/sdk'); console.log(Object.keys(m))"
```

Then update `api/src/services/insforge/client.ts` with the correct init pattern.
Do NOT proceed to sessions.ts or realtime.ts until client.ts is verified working.

### Implementation order

1. `api/src/services/insforge/client.ts` — verify SDK init, update both patterns
2. `api/src/services/insforge/sessions.ts` — test insert + read a call session
3. `api/src/services/insforge/realtime.ts` — broadcast a test event, verify in console
4. `api/src/services/insforge/actions.ts` — wire 5 tool implementations
5. `api/src/services/gemini/liveSession.ts` — wire Gemini + tool dispatch
6. E2E test: `npm run dev` → call Twilio → hear agent → see events in InsForge console
7. `web/public/index.html` — dashboard, point SSE at localhost
8. E2E test with dashboard: call → dashboard updates
9. Deploy web/ to Vercel
10. (Stretch) `api/src/services/replicas/agent.ts`

## Key Risks

1. **InsForge SDK init pattern** — marked with ⚠️ VERIFY in client.ts
2. **InsForge Realtime event name** — marked with ⚠️ VERIFY in realtime.ts
3. **Replicas endpoint** — `/v1/replica` vs `/v1/replicas` — check docs first

## Env Vars Still Needed

Fill these in `.env` before starting:
```
TWILIO_WEBHOOK_BASE=https://YOUR-NGROK.ngrok.io
INSFORGE_URL=https://YOUR-PROJECT.insforge.app
INSFORGE_ANON_KEY=
INSFORGE_SERVICE_KEY=
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
