import "dotenv/config";
import express, { Request } from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import cors from "cors";
import bodyParser from "body-parser";
import { config } from "./config";
import { voiceRouter } from "./routes/voice";
import { handleMediaStream } from "./routes/mediaStream";
import { slackRouter } from "./routes/slack";
import { alertRouter } from "./routes/alert";

const app = express();
app.use(cors());

function captureRawBody(req: Request, _res: express.Response, buf: Buffer): void {
  (req as Request & { rawBody?: string }).rawBody = buf.toString("utf8");
}

app.use(bodyParser.urlencoded({ extended: false, verify: captureRawBody }));
app.use(bodyParser.json({ verify: captureRawBody }));

app.use("/voice", voiceRouter);
app.use("/slack", slackRouter);
app.use("/alert", alertRouter);

app.get("/health", (_req, res) => res.json({ ok: true }));

const server = createServer(app);

const wss = new WebSocketServer({ server, path: "/media-stream" });
wss.on("connection", handleMediaStream);

server.listen(config.PORT, () => {
  console.log(`[server] listening on :${config.PORT}`);
  console.log(`[server] voice webhook: ${config.TWILIO_WEBHOOK_BASE}/voice`);
  console.log(`[server] media stream: wss://…/media-stream`);
});
