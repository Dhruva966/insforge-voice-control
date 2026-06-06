import crypto from "crypto";

type PendingStream = {
  callSid: string;
  expiresAt: number;
};

const STREAM_TTL_MS = 10 * 60 * 1000;
const pendingStreams = new Map<string, PendingStream>();

export function issueStreamToken(callSid: string): string {
  const token = crypto.randomBytes(24).toString("hex");
  pendingStreams.set(token, {
    callSid,
    expiresAt: Date.now() + STREAM_TTL_MS,
  });
  return token;
}

export function consumeStreamToken(callSid: string, token: string | undefined): boolean {
  if (!token) return false;

  const pending = pendingStreams.get(token);
  pendingStreams.delete(token);

  if (!pending) return false;
  if (pending.expiresAt < Date.now()) return false;

  return pending.callSid === callSid;
}
