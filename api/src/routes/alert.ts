import { Router } from "express";
import twilio from "twilio";
import { config } from "../config.js";
import { createAlert } from "../services/alert/store.js";
import { issueStreamToken } from "../services/streamAuth.js";

const router = Router();

// POST /alert/trigger
// Body: { phone: "+1...", file: "src/...", errorType: "TypeError", errorMsg: "...", line: 14 }
router.post("/trigger", async (req, res) => {
  const { phone, file, errorType, errorMsg, line } = req.body as {
    phone: string;
    file?: string;
    errorType?: string;
    errorMsg?: string;
    line?: number;
  };

  if (!phone) {
    res.status(400).json({ error: "phone is required" });
    return;
  }
  if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
    res.status(400).json({ error: "phone must be E.164 format" });
    return;
  }

  const alert = createAlert(
    file ?? "src/middleware/auth.ts",
    errorType ?? "TypeError",
    errorMsg ?? "Cannot read properties of undefined (reading 'userId')",
    line ?? 14
  );
  const callSid = `alert-${alert.id}`;
  const streamToken = issueStreamToken(callSid);

  const streamUrl = `${config.TWILIO_WEBHOOK_BASE.replace("https://", "wss://").replace("http://", "ws://")}/media-stream`;
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${streamUrl}">
      <Parameter name="callSid" value="${callSid}"/>
      <Parameter name="streamToken" value="${streamToken}"/>
      <Parameter name="alertId" value="${alert.id}"/>
    </Stream>
  </Connect>
</Response>`;

  try {
    const twilioClient = twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);
    const call = await twilioClient.calls.create({
      to: phone,
      from: config.TWILIO_PHONE_NUMBER,
      twiml,
    });

    res.json({ callSid: call.sid, alertId: alert.id, status: call.status });
  } catch (err) {
    console.error("[alert] Twilio call error:", err);
    res.status(500).json({ error: (err as Error).message });
  }
});

export { router as alertRouter };
