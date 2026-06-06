import { Request, Response, NextFunction } from "express";
import twilio from "twilio";
import { config } from "../config";

export function twilioValidate(req: Request, res: Response, next: NextFunction): void {
  const validationDisabled = process.env.DISABLE_TWILIO_SIGNATURE_VALIDATION === "true";
  if (validationDisabled) {
    if (config.NODE_ENV === "production") {
      res.status(500).send("Twilio signature validation cannot be disabled in production");
      return;
    }
    next();
    return;
  }

  const signature = req.headers["x-twilio-signature"] as string;
  const url = `${config.TWILIO_WEBHOOK_BASE}${req.originalUrl}`;
  const valid = twilio.validateRequest(
    config.TWILIO_AUTH_TOKEN,
    signature,
    url,
    req.body as Record<string, string>
  );

  if (!valid) {
    res.status(403).send("Forbidden");
    return;
  }

  next();
}
