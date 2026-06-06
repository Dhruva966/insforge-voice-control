/**
 * Post a JSON payload to a Slack webhook URL.
 * Resolves silently on network errors when `swallow` is true (fire-and-forget).
 */
export async function postSlackWebhook(
  url: string,
  payload: Record<string, unknown>,
  swallow = false
): Promise<void> {
  const res = await (swallow
    ? fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch((err) => {
        console.error("[slack] webhook error:", err);
        return undefined;
      })
    : fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }));

  if (res && !res.ok && !swallow) {
    throw new Error(`Slack webhook HTTP ${res.status}`);
  }
}
