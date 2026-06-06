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

let readyPromise: Promise<void> | null = null;

async function connectAndSubscribe(): Promise<void> {
  await insforge.realtime.connect();
  const response = await insforge.realtime.subscribe(CHANNEL);
  if (!response.ok) {
    throw new Error(response.error?.message ?? `Failed to subscribe to ${CHANNEL}`);
  }
}

async function ensureReady() {
  // Try to use existing connection if healthy
  if (readyPromise && insforge.realtime.isConnected) {
    return readyPromise;
  }
  // Otherwise, initialize or queue onto the active initialization
  if (!readyPromise || !insforge.realtime.isConnected) {
    readyPromise = connectAndSubscribe().catch((err) => {
      readyPromise = null; // reset on failure
      throw err;
    });
  }
  return readyPromise;
}

export async function broadcastEvent(event: CallEvent): Promise<void> {
  try {
    await ensureReady();
    await insforge.realtime.publish(CHANNEL, EVENT_NAME, event);
  } catch (err) {
    console.error("[realtime] broadcastEvent error:", err);
  }
}
