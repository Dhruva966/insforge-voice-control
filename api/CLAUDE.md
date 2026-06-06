# api/ — Voice Agent Backend

Express + WebSocket server. Handles Twilio voice calls, runs Gemini Live voice AI,
executes InsForge infra actions, broadcasts events to dashboard via InsForge Realtime.

## Entry Point

`src/server.ts` — Express HTTP + WebSocketServer on the same port.

## Key Routes

- `POST /voice` → returns TwiML `<Connect><Stream>` to open WebSocket
- `WS /media-stream` → bidirectional audio bridge between Twilio and Gemini

## Dev

```bash
npm install
npm run dev     # nodemon + tsx, hot reload
npm run check   # tsc --noEmit — run before every commit
```

## InsForge SDK Notes

> VERIFY at hackathon start before writing any InsForge code.

```bash
node -e "const m=require('@insforge/sdk'); console.log(Object.keys(m))"
```

See `client.ts` for both init patterns — uncomment the correct one.

## Audio Pipeline

```
Twilio → mulaw 8kHz base64 → twilioToGemini() → PCM16 16kHz base64 → Gemini Live
Gemini → PCM16 24kHz base64 → geminiToTwilio() → mulaw 8kHz base64 → Twilio
```

Codec: `alawmulaw` package. Code: `src/services/gemini/audioConverter.ts` (copy exactly from reference).

## Twilio Event Order

1. `connected` — ignore
2. `start` — `frame.start.callSid`, `frame.start.streamSid`, `frame.start.mediaFormat`
3. `media` — `frame.media.payload` (base64 mulaw audio)
4. `stop` — finalize session

## Security

- Twilio signature validated in `middleware/twilioValidate.ts`
- Set `DISABLE_TWILIO_SIGNATURE_VALIDATION=true` only for explicit local testing, never in production
- Slack slash commands require a valid `SLACK_SIGNING_SECRET`
- `runSqlQuery` rejects any SQL that doesn't start with SELECT
