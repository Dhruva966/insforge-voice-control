import { insforge } from "./client";
import { broadcastEvent } from "./realtime";

type DbResult = { data: unknown; error: { message: string } | null };

function assertOk(result: DbResult, op: string): void {
  if (result.error) throw new Error(`InsForge DB ${op}: ${result.error.message}`);
}

export async function createSession(callSid: string, callerPhone: string): Promise<void> {
  const result = await insforge.database.from("voice_calls").insert([{
    call_sid: callSid,
    caller_phone: callerPhone,
    started_at: new Date().toISOString(),
    status: "active",
  }]) as DbResult;
  assertOk(result, "insert");

  await broadcastEvent({
    type: "call_started",
    callSid,
    callerPhone,
    timestamp: new Date().toISOString(),
  });
}

export async function completeSession(callSid: string, actionCount: number): Promise<void> {
  const result = await insforge.database.from("voice_calls").update({
    status: "completed",
    ended_at: new Date().toISOString(),
    action_count: actionCount,
  }).eq("call_sid", callSid) as DbResult;
  assertOk(result, "update");

  await broadcastEvent({
    type: "call_ended",
    callSid,
    actionCount,
    duration: 0,
  });
}
