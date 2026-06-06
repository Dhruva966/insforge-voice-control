import WebSocket from "ws";
import { completeSession } from "../services/insforge/sessions";
import { openGeminiSession, GeminiHandle } from "../services/gemini/liveSession";
import { consumeAlert } from "../services/alert/store";

interface TwilioFrame {
  event: string;
  start?: {
    callSid: string;
    streamSid: string;
    mediaFormat?: { encoding: string; sampleRate: number };
    customParameters?: Record<string, string>;
  };
  media?: { payload: string };
  stop?: { callSid: string };
}

export function handleMediaStream(ws: WebSocket): void {
  let callSid: string | null = null;
  let streamSid: string | null = null;
  let gemini: GeminiHandle | null = null;
  let completed = false;

  function wsSend(payload: Record<string, unknown>): void {
    if (ws.readyState === WebSocket.OPEN && streamSid) {
      ws.send(JSON.stringify(payload));
    }
  }

  async function finalize() {
    if (completed || !callSid) return;
    completed = true;
    gemini?.close();
    await completeSession(callSid, gemini?.actionCount ?? 0).catch((err) =>
      console.error(`[${callSid}] completeSession error:`, err)
    );
  }

  ws.on("message", async (raw: Buffer) => {
    let frame: TwilioFrame;
    try {
      frame = JSON.parse(raw.toString());
    } catch {
      return;
    }

    // connected fires before start — ignore
    if (frame.event === "connected") return;

    if (frame.event === "start" && frame.start) {
      callSid = frame.start.callSid;
      streamSid = frame.start.streamSid;

      // Check for alert context passed via Twilio Stream custom parameters
      const alertId = frame.start.customParameters?.alertId;
      const alertCtx = alertId ? consumeAlert(alertId) : null;

      console.log(`[${callSid}] call started, stream ${streamSid}${alertCtx ? ` (alert: ${alertCtx.id})` : ""}`);

      gemini = await openGeminiSession(
        callSid,
        (base64Mulaw) => {
          wsSend({ event: "media", streamSid, media: { payload: base64Mulaw } });
        },
        (err) => {
          console.error(`[${callSid}] Gemini error:`, err.message);
          ws.close();
        },
        () => {
          // barge-in: tool call started, clear Twilio's playback buffer
          wsSend({ event: "clear", streamSid });
        },
        alertCtx ?? undefined
      ).catch((err) => {
        console.error(`[${callSid}] failed to open Gemini session:`, err);
        ws.close();
        return null;
      });
    }

    if (frame.event === "media" && frame.media && gemini) {
      gemini.sendAudio(frame.media.payload);
    }

    if (frame.event === "stop") {
      await finalize();
      ws.close();
    }
  });

  ws.on("close", () => finalize());
  ws.on("error", (err) => {
    console.error("MediaStream WS error:", err.message);
    finalize();
  });
}
