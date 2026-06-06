import twilio from "twilio";
import { config } from "../config";

const VoiceResponse = twilio.twiml.VoiceResponse;

export function buildStreamTwiml(customParameters: Record<string, string> = {}): string {
  const twiml = new VoiceResponse();
  const connect = twiml.connect();
  const wsUrl = config.TWILIO_WEBHOOK_BASE
    .replace(/^https:\/\//, "wss://")
    .replace(/^http:\/\//, "ws://");
  const stream = connect.stream({ url: `${wsUrl}/media-stream` });

  for (const [name, value] of Object.entries(customParameters)) {
    stream.parameter({ name, value });
  }

  return twiml.toString();
}

export function buildHangupTwiml(sayText: string): string {
  const twiml = new VoiceResponse();
  twiml.say({ voice: "Polly.Joanna" }, sayText);
  twiml.hangup();
  return twiml.toString();
}
