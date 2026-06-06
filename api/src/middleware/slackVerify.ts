import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { config } from "../config";

const FIVE_MINUTES = 5 * 60;

export function slackVerify(req: Request, res: Response, next: NextFunction): void {
  if (config.NODE_ENV === "development" && !config.SLACK_SIGNING_SECRET) {
    next();
    return;
  }

  const signingSecret = config.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    res.status(500).json({ error: "SLACK_SIGNING_SECRET not configured" });
    return;
  }

  const timestamp = req.headers["x-slack-request-timestamp"] as string | undefined;
  const slackSignature = req.headers["x-slack-signature"] as string | undefined;

  if (!timestamp || !slackSignature) {
    res.status(403).json({ error: "Missing Slack signature headers" });
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > FIVE_MINUTES) {
    res.status(403).json({ error: "Request timestamp too old" });
    return;
  }

  const rawBody = (req as Request & { rawBody?: string }).rawBody ?? JSON.stringify(req.body);
  const sigBasestring = `v0:${timestamp}:${rawBody}`;
  const hmac = crypto.createHmac("sha256", signingSecret).update(sigBasestring).digest("hex");
  const expectedSignature = `v0=${hmac}`;

  if (!crypto.timingSafeEqual(Buffer.from(slackSignature), Buffer.from(expectedSignature))) {
    res.status(403).json({ error: "Invalid Slack signature" });
    return;
  }

  next();
}
