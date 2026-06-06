// ⚠️ VERIFY at hackathon:
//   1. InsForge SDK init: createClient vs new InsForge
//   2. Realtime event name: "call_event" — must match what api/src/services/insforge/realtime.ts publishes

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: Request): Promise<Response> {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let insforge: {
        realtime: {
          connect: () => Promise<void>;
          subscribe: (ch: string) => Promise<void>;
          on: (event: string, handler: (data: unknown) => void) => void;
        };
      };

      try {
        // ⚠️ verify init pattern at hackathon (createClient vs new InsForge)
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const sdk = require("@insforge/sdk") as Record<string, (...args: unknown[]) => unknown>;
        if (sdk["createClient"]) {
          insforge = sdk["createClient"]({
            baseUrl: process.env.INSFORGE_URL,
            anonKey: process.env.INSFORGE_ANON_KEY,
          }) as typeof insforge;
        } else {
          const InsForge = sdk["InsForge"] as new (opts: { url: string; apiKey: string }) => typeof insforge;
          insforge = new InsForge({
            url: process.env.INSFORGE_URL ?? "",
            apiKey: process.env.INSFORGE_ANON_KEY ?? "",
          });
        }

        await insforge.realtime.connect();
        await insforge.realtime.subscribe("voice-ops");

        // ⚠️ verify event name matches backend publish
        insforge.realtime.on("call_event", (data: unknown) => {
          const msg = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(msg));
        });
      } catch (err) {
        console.error("[events] InsForge realtime init failed:", err);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", message: String(err) })}\n\n`));
      }

      // 25s heartbeat to keep SSE connection alive
      const hb = setInterval(() => {
        controller.enqueue(encoder.encode(": heartbeat\n\n"));
      }, 25000);

      req.signal.addEventListener("abort", () => {
        clearInterval(hb);
        controller.close();
      });
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
