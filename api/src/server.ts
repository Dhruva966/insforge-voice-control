import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import cors from "cors";
import bodyParser from "body-parser";
import { config } from "./config";
import { voiceRouter } from "./routes/voice";
import { handleMediaStream } from "./routes/mediaStream";

const app = express();
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use("/voice", voiceRouter);

app.get("/health", (_req, res) => res.json({ ok: true }));

const server = createServer(app);

const wss = new WebSocketServer({ server, path: "/media-stream" });
wss.on("connection", handleMediaStream);

server.listen(config.PORT, () => {
  console.log(`[server] listening on :${config.PORT}`);
  console.log(`[server] voice webhook: ${config.TWILIO_WEBHOOK_BASE}/voice`);
  console.log(`[server] media stream: wss://…/media-stream`);
});
