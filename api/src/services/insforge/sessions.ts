// ⚠️ VERIFY at hackathon: insforge.from(...) vs insforge.database.from(...)
// Test with: npx @insforge/cli db query "SELECT 1"
import { insforge } from "./client";
import { broadcastEvent } from "./realtime";

export async function createSession(callSid: string, callerPhone: string): Promise<void> {
  // Try insforge.from first; if that errors, switch to insforge.database.from
  const client = insforge as {
    from?: (t: string) => { insert: (d: unknown) => Promise<unknown> };
    database?: { from: (t: string) => { insert: (d: unknown) => Promise<unknown> } };
  };

  const db = client.database?.from ?? client.from?.bind(client);
  if (!db) throw new Error("InsForge SDK: cannot find database accessor (.from or .database.from)");

  await db("calls").insert({
    call_sid: callSid,
    started_at: new Date().toISOString(),
    status: "active",
  });

  await broadcastEvent({
    type: "call_started",
    callSid,
    callerPhone,
    timestamp: new Date().toISOString(),
  });
}

export async function completeSession(callSid: string, actionCount: number): Promise<void> {
  const client = insforge as {
    from?: (t: string) => { update: (d: unknown) => { eq: (k: string, v: string) => Promise<unknown> } };
    database?: { from: (t: string) => { update: (d: unknown) => { eq: (k: string, v: string) => Promise<unknown> } } };
  };

  const db = client.database?.from ?? client.from?.bind(client);
  if (!db) return;

  await db("calls").update({
    status: "completed",
    ended_at: new Date().toISOString(),
    action_count: actionCount,
  }).eq("call_sid", callSid);

  await broadcastEvent({
    type: "call_ended",
    callSid,
    actionCount,
    duration: 0,
  });
}
