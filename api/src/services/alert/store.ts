export interface AlertContext {
  id: string;
  file: string;
  errorType: string;
  errorMsg: string;
  line: number;
  createdAt: number;
}

// Keyed by alertId — consumed when the media stream starts
export const pendingAlerts = new Map<string, AlertContext>();

export function createAlert(file: string, errorType: string, errorMsg: string, line: number): AlertContext {
  const id = `alert_${Date.now()}`;
  const ctx: AlertContext = { id, file, errorType, errorMsg, line, createdAt: Date.now() };
  pendingAlerts.set(id, ctx);
  setTimeout(() => pendingAlerts.delete(id), 5 * 60 * 1000); // TTL 5 min
  return ctx;
}

export function consumeAlert(id: string): AlertContext | null {
  const ctx = pendingAlerts.get(id);
  if (ctx) pendingAlerts.delete(id);
  return ctx ?? null;
}
