# web/ — Dashboard Frontend

Vanilla HTML dashboard deployed to Vercel. No build step. One SSE serverless function.

## Files

- `public/index.html` — single-file SPA, 4 panels, CDN-only deps
- `api/events.ts` — Vercel serverless function, SSE relay from InsForge Realtime

## Local Dev

Run the dashboard through Vercel so the local SSE function exists:

```bash
cd web/
npm install
npx vercel dev --listen 3001
```

Open `http://localhost:3001`.

## Vercel Deploy

```bash
cd web/
npm install
vercel env add INSFORGE_URL
vercel env add INSFORGE_KEY
vercel --prod
```

## SSE Function Notes

`api/events.ts` has `maxDuration: 300` in vercel.json — required for SSE connections.
Without it, Vercel cuts the function at 10s.

InsForge Realtime event name (`call_event`) must match what the backend publishes.
⚠️ Verify at hackathon start.

## Env Vars (Vercel)

```
INSFORGE_URL=        (from InsForge project settings)
INSFORGE_KEY=        (server-side project admin key; stored only in Vercel env)
```
