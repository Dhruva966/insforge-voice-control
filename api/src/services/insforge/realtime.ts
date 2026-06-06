// ⚠️ VERIFY at hackathon:
//   1. publish signature: (channel, eventName, payload) vs (channel, payload)
//   2. event name: "call_event" — must match what web/api/events.ts listens for
import { insforge } from "./client";

export type CallEvent =
  | { type: "call_started";    callSid: string; callerPhone: string; timestamp: string }
  | { type: "transcript";      callSid: string; role: "agent" | "user"; text: string; timestamp: string }
  | { type: "action_proposed"; callSid: string; action: string; params: object; diff: string }
  | { type: "action_executing";callSid: string; action: string }
  | { type: "action_done";     callSid: string; action: string; result: string; success: boolean; durationMs: number }
  | { type: "call_ended";      callSid: string; duration: number; actionCount: number };

const CHANNEL = "voice-ops";
const EVENT_NAME = "call_event"; // ⚠️ verify matches web/api/events.ts listener

let connected = false;

async function ensureConnected() {
  if (connected) return;
  const rt = (insforge as { realtime: { connect: () => Promise<void> } }).realtime;
  await rt.connect();
  connected = true;
}

export async function broadcastEvent(event: CallEvent): Promise<void> {
  try {
    await ensureConnected();
    const rt = (insforge as {
      realtime: {
        publish: (channel: string, eventName: string, payload: unknown) => void | Promise<void>;
      };
    }).realtime;

    // Try 3-arg form; if SDK only takes 2 args, swap to:
    // rt.publish(CHANNEL, event);
    await rt.publish(CHANNEL, EVENT_NAME, event);
  } catch (err) {
    console.error("[realtime] broadcastEvent error:", err);
  }
}
