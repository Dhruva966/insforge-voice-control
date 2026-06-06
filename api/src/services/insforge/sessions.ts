import { insforge } from "./client";
import { broadcastEvent } from "./realtime";

type DbResult<T = unknown> = { data: T; error: { message: string } | null };
type VoiceCallRow = {
  id: string;
  call_sid: string;
  caller_phone: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_s: number | null;
  action_count: number | null;
  status: string | null;
};

function assertOk(result: DbResult, op: string): void {
  if (result.error) throw new Error(`InsForge DB ${op}: ${result.error.message}`);
}

async function getSession(callSid: string): Promise<VoiceCallRow | null> {
  const result = await insforge.database
    .from("voice_calls")
    .select("id, call_sid, caller_phone, started_at, ended_at, duration_s, action_count, status")
    .eq("call_sid", callSid) as DbResult<VoiceCallRow[]>;
  assertOk(result, "select");
  return result.data[0] ?? null;
}

function isDuplicateInsertError(message: string | undefined): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return lower.includes("duplicate") || lower.includes("unique");
}

export async function createSession(callSid: string, callerPhone: string): Promise<void> {
  const result = await insforge.database.from("voice_calls").insert([{
    call_sid: callSid,
    caller_phone: callerPhone,
    started_at: new Date().toISOString(),
    status: "active",
  }]) as DbResult;

  if (result.error) {
    if (isDuplicateInsertError(result.error.message) && await getSession(callSid)) {
      return;
    }
    assertOk(result, "insert");
  }

  void broadcastEvent({
    type: "call_started",
    callSid,
    callerPhone,
    timestamp: new Date().toISOString(),
  }).catch((err) => console.error(`[${callSid}] call_started broadcast error:`, err));
}

export async function completeSession(callSid: string, actionCount: number): Promise<void> {
  const existing = await getSession(callSid);
  const endedAt = new Date();
  const startedAtMs = existing?.started_at ? Date.parse(existing.started_at) : NaN;
  const durationSeconds = Number.isFinite(startedAtMs)
    ? Math.max(0, Math.round((endedAt.getTime() - startedAtMs) / 1000))
    : 0;

  const result = await insforge.database.from("voice_calls").update({
    status: "completed",
    ended_at: endedAt.toISOString(),
    duration_s: durationSeconds,
    action_count: actionCount,
  }).eq("call_sid", callSid) as DbResult;
  assertOk(result, "update");

  void broadcastEvent({
    type: "call_ended",
    callSid,
    actionCount,
    duration: durationSeconds,
  }).catch((err) => console.error(`[${callSid}] call_ended broadcast error:`, err));
}
