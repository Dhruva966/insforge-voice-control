import { Router } from "express";
import { io } from "socket.io-client";
import { config } from "../config.js";

const router = Router();

router.get("/", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();

  const socket = io(config.INSFORGE_URL, {
    transports: ["websocket"],
    auth: { apiKey: config.INSFORGE_KEY },
  });

  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let cleanedUp = false;

  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    if (heartbeat) clearInterval(heartbeat);
    socket.disconnect();
    try { res.end(); } catch { /* ignore */ }
  };

  socket.on("connect", () => {
    socket.emit("realtime:subscribe", { channel: "voice-ops" }, (response: { ok: boolean; error?: { message: string } }) => {
      if (!response.ok) {
        res.write(`data: ${JSON.stringify({ type: "error", message: response.error?.message ?? "Subscribe failed" })}\n\n`);
        cleanup();
        return;
      }
      heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 25000);
    });
  });

  socket.on("call_event", (message: unknown) => {
    if (!cleanedUp) res.write(`data: ${JSON.stringify(message)}\n\n`);
  });

  socket.on("connect_error", (err) => {
    res.write(`data: ${JSON.stringify({ type: "error", message: err.message })}\n\n`);
    cleanup();
  });

  req.on("close", cleanup);
});

export { router as eventsRouter };
