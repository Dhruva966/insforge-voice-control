import { insforge } from "./client";

export type CallEvent =
  | { type: "call_started";     callSid: string; callerPhone: string; timestamp: string }
  | { type: "transcript";       callSid: string; role: "agent" | "user"; text: string; timestamp: string }
  | { type: "action_proposed";  callSid: string; action: string; params: object; diff: string }
  | { type: "action_executing"; callSid: string; action: string }
  | { type: "action_done";      callSid: string; action: string; result: string; success: boolean; durationMs: number }
  | { type: "call_ended";       callSid: string; duration: number; actionCount: number };

const CHANNEL = "voice-ops";
const EVENT_NAME = "call_event";

let initialized = false;

async function ensureReady() {
  if (initialized) return;
  await insforge.realtime.connect();
  await insforge.realtime.subscribe(CHANNEL);
  initialized = true;
}

export async function broadcastEvent(event: CallEvent): Promise<void> {
  try {
    await ensureReady();
    await insforge.realtime.publish(CHANNEL, EVENT_NAME, event);
  } catch (err) {
    console.error("[realtime] broadcastEvent error:", err);
  }
}
