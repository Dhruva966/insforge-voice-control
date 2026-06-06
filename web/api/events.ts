import { createAdminClient } from "@insforge/sdk";
import type { IncomingMessage, ServerResponse } from "http";

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  // SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders();

  let cleanedUp = false;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  try {
    const baseUrl = process.env.INSFORGE_URL;
    const apiKey = process.env.INSFORGE_KEY;
    if (!baseUrl || !apiKey) {
      throw new Error("Missing INSFORGE_URL or INSFORGE_KEY");
    }

    const insforge = createAdminClient({ baseUrl, apiKey });
    await insforge.realtime.connect();
    const response = await insforge.realtime.subscribe("voice-ops");
    if (!response.ok) {
      throw new Error(response.error?.message ?? "Realtime subscribe failed");
    }

    const onCallEvent = (data: unknown) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      if (heartbeat) clearInterval(heartbeat);
      insforge.realtime.off("call_event", onCallEvent);
      insforge.realtime.unsubscribe("voice-ops");
      insforge.realtime.disconnect();
      try {
        res.end();
      } catch {
        // ignore double-end during disconnect races
      }
    };

    insforge.realtime.on("call_event", onCallEvent);

    // 25s heartbeat to keep SSE connection alive
    heartbeat = setInterval(() => {
      res.write(": heartbeat\n\n");
    }, 25000);

    // Cleanup on client disconnect
    req.on("close", cleanup);
  } catch (err) {
    res.write(
      `data: ${JSON.stringify({ type: "error", message: String(err) })}\n\n`
    );
    res.end();
  }
}
