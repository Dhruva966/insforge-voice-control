# Deployment Runbook

## Local Development

```bash
# 1. Fill the repo-root .env (see Environment Variables section below)
# 2. Install and start API
cd api
npm install
npm run dev     # starts on PORT (default 3000)

# 3. In separate terminal, expose via ngrok
ngrok http 3000
# Copy the https URL

# 4. Update .env
TWILIO_WEBHOOK_BASE=https://xxxx.ngrok.io

# 5. Set Twilio webhook
# console.twilio.com → Phone Numbers → +19255155725 → Voice → Webhook
# Method: POST, URL: https://xxxx.ngrok.io/voice

# 6. Run dashboard locally
cd web
npm install
npx vercel dev --listen 3001
# Open http://localhost:3001
```

## InsForge Setup

```bash
npx @insforge/cli login
npx @insforge/cli link    # link to your InsForge project

# Verify connection
npx @insforge/cli current

# Run migrations from /db because the CLI resolves migrations/ relative to cwd
cd db
npx @insforge/cli db migrations up --all
cd ..

# Verify tables exist
npx @insforge/cli db query "SELECT table_name FROM information_schema.tables WHERE table_schema='public'"
```

## Vercel Dashboard Deployment

```bash
npm i -g vercel
vercel login

cd web/
npm install
vercel link
# Add env vars
vercel env add INSFORGE_URL
vercel env add INSFORGE_KEY

# Deploy
vercel --prod
# Output: https://xxxx.vercel.app
```

After Vercel deploy, the dashboard can keep using `const SSE_URL = "/api/events"` as-is.

## Environment Variables

### repo-root .env

```bash
# Required
GEMINI_API_KEY=                         # Google AI Studio key
GEMINI_MODEL=gemini-3.1-flash-live-preview
GEMINI_VOICE=Puck                       # Gemini voice name

TWILIO_ACCOUNT_SID=                     # Twilio Console
TWILIO_AUTH_TOKEN=                      # Twilio Console
TWILIO_PHONE_NUMBER=+19255155725
TWILIO_WEBHOOK_BASE=                    # ngrok URL or production URL

INSFORGE_URL=                           # npx @insforge/cli current
INSFORGE_KEY=                           # InsForge project settings / linked project key

REPLICAS_API_KEY=                       # app.tryreplicas.com → API Keys
SLACK_SIGNING_SECRET=                   # required for POST /slack/command
SLACK_WEBHOOK_URL=                      # optional, for send_slack notifications

NODE_ENV=development                    # development | production
PORT=3000
DISABLE_TWILIO_SIGNATURE_VALIDATION=false  # set true only for manual local testing; never in production
```

### web/ Vercel env vars

```
INSFORGE_URL=      (same as above)
INSFORGE_KEY=  (same as above — server-side Vercel env only)
```

## Check TypeScript Before Committing

```bash
cd api && npm run check    # tsc --noEmit
```

## Demo Checklist

- [ ] `npx @insforge/cli current` shows your project
- [ ] `npm run dev` starts without errors
- [ ] ngrok running, TWILIO_WEBHOOK_BASE set
- [ ] Twilio webhook configured to `{TWILIO_WEBHOOK_BASE}/voice`
- [ ] Dashboard open (local or Vercel URL)
- [ ] Call +19255155725 → hear "InsForge Control online. What do you need?"
- [ ] Say "show me the last five calls" → SQL diff appears on dashboard
- [ ] Say "check the InsForge logs" → logs appear in exec log
