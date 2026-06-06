import twilio from "twilio";
import { config } from "../config";

export const twilioClient = twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);
