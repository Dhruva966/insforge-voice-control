import { config } from "../../config.js";

const BASE_V3 = config.DEVIN_ORG_ID
  ? `https://api.devin.ai/v3/organizations/${config.DEVIN_ORG_ID}`
  : null;

const AUTH = { Authorization: `Bearer ${config.DEVIN_API_KEY ?? ""}` };

export interface DevinSession {
  session_id: string;
  url: string;
  status: string;
  status_detail?: string;
  acus_consumed?: number;
  pull_requests?: { url: string; state: string }[];
}

function assertConfigured(): void {
  if (!config.DEVIN_API_KEY) throw new Error("DEVIN_API_KEY not configured");
  if (!BASE_V3) throw new Error("DEVIN_ORG_ID not configured — check app.devin.ai Settings → API Keys");
}

export async function createDevinSession(
  prompt: string,
  opts: { repos?: string[]; title?: string; maxAcuLimit?: number } = {}
): Promise<DevinSession> {
  assertConfigured();
  const res = await fetch(`${BASE_V3}/sessions`, {
    method: "POST",
    headers: { ...AUTH, "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      repos: opts.repos ?? ["Dhruva966/gojo-mock-api"],
      title: opts.title,
      max_acu_limit: opts.maxAcuLimit ?? 50,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Devin createSession HTTP ${res.status}: ${text}`);
  }
  return res.json() as Promise<DevinSession>;
}

export async function getDevinSession(sessionId: string): Promise<DevinSession> {
  assertConfigured();
  const res = await fetch(`${BASE_V3}/sessions/${sessionId}`, { headers: AUTH });
  if (!res.ok) throw new Error(`Devin getSession HTTP ${res.status}`);
  return res.json() as Promise<DevinSession>;
}

export async function sendDevinMessage(sessionId: string, message: string): Promise<void> {
  assertConfigured();
  const res = await fetch(`${BASE_V3}/sessions/${sessionId}/messages`, {
    method: "POST",
    headers: { ...AUTH, "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error(`Devin sendMessage HTTP ${res.status}`);
}

/** Poll until done or timeout. Returns final session state. */
export async function pollDevinSession(
  sessionId: string,
  onUpdate?: (session: DevinSession) => void,
  timeoutMs = 120_000
): Promise<DevinSession> {
  const deadline = Date.now() + timeoutMs;
  let delay = 4000;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 1.5, 15_000); // exponential backoff, cap 15s

    const session = await getDevinSession(sessionId);
    onUpdate?.(session);

    const done = ["finished", "exit", "expired", "error"].includes(session.status);
    if (done) return session;
  }

  return getDevinSession(sessionId);
}
