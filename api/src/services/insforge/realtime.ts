import { io, Socket } from "socket.io-client";
import { config } from "../../config.js";

export type CallEvent =
  | { type: "call_started";          callSid: string; callerPhone: string; timestamp: string }
  | { type: "transcript";            callSid: string; role: "agent" | "user"; text: string; timestamp: string }
  | { type: "action_proposed";       callSid: string; action: string; params: object; diff: string; sponsor?: string }
  | { type: "action_executing";      callSid: string; action: string; sponsor?: string }
  | { type: "action_done";           callSid: string; action: string; result: string; success: boolean; durationMs: number; sponsor?: string; diff?: string }
  | { type: "call_ended";            callSid: string; duration: number; actionCount: number }
  | { type: "sms_sent";              callSid: string; to: string; messageSid: string }
  | { type: "coding_agent_started";  callSid: string; agentId: string; task: string }
  | { type: "coding_agent_done";     callSid: string; agentId: string; diff: string; filesChanged: string[] }
  | { type: "ai_analysis_done";      callSid: string; question: string; analysis: string }
  | { type: "slack_sent";            callSid: string; message: string }
  | { type: "devin_agent_started";   callSid: string; sessionId: string; sessionUrl: string; task: string }
  | { type: "devin_agent_update";    callSid: string; sessionId: string; narration: string; routedFrom?: string }
  | { type: "devin_agent_done";      callSid: string; sessionId: string; sessionUrl: string; narration: string; diff?: string; prUrl?: string }
  | { type: "agent_routed";          callSid: string; sessionId: string; agentNum: number; instruction: string };

const CHANNEL = "voice-ops";
const EVENT_NAME = "call_event";

let socket: Socket | null = null;
let subscribed = false;
let connecting: Promise<void> | null = null;

async function ensureReady(): Promise<void> {
  if (socket?.connected && subscribed) return;
  if (connecting) return connecting;

  connecting = new Promise<void>((resolve, reject) => {
    if (socket) {
      socket.disconnect();
      socket = null;
      subscribed = false;
    }

    const s = io(config.INSFORGE_URL, {
      transports: ["websocket"],
      auth: { apiKey: config.INSFORGE_KEY },
    });

    const timeout = setTimeout(() => {
      s.disconnect();
      connecting = null;
      reject(new Error("Realtime connection timeout"));
    }, 10000);

    s.on("connect", () => {
      s.emit("realtime:subscribe", { channel: CHANNEL }, (res: { ok: boolean; error?: { message: string } }) => {
        clearTimeout(timeout);
        connecting = null;
        if (res.ok) {
          socket = s;
          subscribed = true;
          resolve();
        } else {
          s.disconnect();
          reject(new Error(res.error?.message ?? "Subscribe failed"));
        }
      });
    });

    s.on("connect_error", (err) => {
      clearTimeout(timeout);
      connecting = null;
      reject(err);
    });

    s.on("disconnect", () => {
      subscribed = false;
      socket = null;
      connecting = null;
    });
  });

  return connecting;
}

export async function broadcastEvent(event: CallEvent): Promise<void> {
  try {
    await ensureReady();
    if (!socket?.connected) {
      console.error("[realtime] socket not connected after ensureReady");
      return;
    }
    socket.emit("realtime:publish", {
      channel: CHANNEL,
      event: EVENT_NAME,
      payload: event,
    });
  } catch (err) {
    console.error("[realtime] broadcastEvent error:", err);
  }
}
