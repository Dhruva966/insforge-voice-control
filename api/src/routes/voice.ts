import { Router, Request, Response } from "express";
import { twilioValidate } from "../middleware/twilioValidate";
import { createSession } from "../services/insforge/sessions";
import { buildStreamTwiml, buildHangupTwiml } from "../utils/twiml";
import { normalizePhone } from "../utils/phone";

export const voiceRouter = Router();

voiceRouter.post("/", twilioValidate, async (req: Request, res: Response): Promise<void> => {
  const { CallSid, From } = req.body as { CallSid: string; From: string };
  const callerPhone = normalizePhone(From);

  try {
    await createSession(CallSid, callerPhone);
    res.type("text/xml").send(buildStreamTwiml());
  } catch (err) {
    console.error("[voice] error creating session:", err);
    res.type("text/xml").send(
      buildHangupTwiml("Sorry, we're having trouble right now. Please call back in a moment.")
    );
  }
});
