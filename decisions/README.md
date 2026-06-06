# Architecture Decision Records

## ADR-001: InsForge over Supabase

**Decision:** Use `@insforge/sdk` exclusively. Do not import `@supabase/supabase-js`.

**Reason:** InsForge is a hackathon sponsor and the target infra platform. It has a
different API surface than Supabase. Using Supabase would bypass the point of the demo.

## ADR-002: Vanilla HTML dashboard (no React/Vue)

**Decision:** `web/public/index.html` is a single-file vanilla HTML + JS page.

**Reason:** Matches the dry-cleaning reference which is proven to work. No build step
needed, faster iteration, deploys as Vercel static with one SSE serverless function.

## ADR-003: `<Connect>` TwiML for bidirectional audio

**Decision:** Use `<Connect><Stream>` not `<Start><Stream>`.

**Reason:** `<Start>` is one-directional (Twilio → server only). `<Connect>` is
bidirectional and blocks the call, allowing the server to send audio back to the caller.

## ADR-004: mulaw↔PCM16 via `alawmulaw` package

**Decision:** Use `alawmulaw` npm package for codec conversion, not a custom implementation.

**Reason:** Proven in the dry-cleaning reference. Linear interpolation for upsampling,
nearest-neighbor for downsampling. No external native deps.

## ADR-005: Replicas as stretch goal

**Decision:** Replicas coding agent integration is a stretch goal, not core.

**Reason:** Codex review flagged 6-hour solo scope as too ambitious with Replicas included.
Core demo (run_sql + add_index + get_logs + dashboard) is compelling without it.

## ADR-006: SSE relay via Vercel serverless function

**Decision:** Dashboard connects to InsForge Realtime via a Vercel serverless SSE function,
not directly from browser.

**Reason:** Avoids exposing INSFORGE_SERVICE_KEY in browser. Anon key goes to Vercel env.
SSE function handles InsForge Realtime subscription server-side and streams to browser.
