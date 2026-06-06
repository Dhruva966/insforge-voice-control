import { createAdminClient } from "@insforge/sdk";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: Request): Promise<Response> {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
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
          const msg = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(msg));
        };

        const cleanup = () => {
          if (cleanedUp) return;
          cleanedUp = true;
          if (heartbeat) clearInterval(heartbeat);
          insforge.realtime.off("call_event", onCallEvent);
          insforge.realtime.unsubscribe("voice-ops");
          insforge.realtime.disconnect();
          try {
            controller.close();
          } catch {
            // ignore double-close during disconnect races
          }
        };

        insforge.realtime.on("call_event", onCallEvent);
        req.signal.addEventListener("abort", cleanup, { once: true });

        // 25s heartbeat to keep SSE connection alive
        heartbeat = setInterval(() => {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        }, 25000);
      } catch (err) {
        console.error("[events] InsForge realtime init failed:", err);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", message: String(err) })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
