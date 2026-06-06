import { Router } from "express";
import { executeTool } from "../services/insforge/actions.js";

const router = Router();

function parseGojoCommand(text: string): { tool: string; params: Record<string, string> } | null {
  const lower = text.toLowerCase().trim();

  if (lower.startsWith("sql ") || lower.startsWith("query ")) {
    const sql = text.replace(/^(sql|query)\s+/i, "").trim();
    return { tool: "run_sql", params: { sql } };
  }
  if (lower === "logs" || lower.startsWith("logs ")) {
    const source = lower.includes("function") ? "function.logs" : "insforge.logs";
    return { tool: "get_logs", params: { source } };
  }
  if (lower === "storage") {
    return { tool: "check_storage", params: {} };
  }
  if (lower.startsWith("analyze ")) {
    return { tool: "analyze_with_ai", params: { question: text.replace(/^analyze\s+/i, "").trim(), data: "" } };
  }
  if (lower.startsWith("code ") || lower.startsWith("agent ") || lower.startsWith("build ")) {
    const task = text.replace(/^(code|agent|build)\s+/i, "").trim();
    return { tool: "spawn_coding_agent", params: { task } };
  }
  if (lower.startsWith("sms ") || lower.startsWith("text ")) {
    // format: "sms +14155551234 your message"
    const parts = text.replace(/^(sms|text)\s+/i, "").trim();
    const [to, ...rest] = parts.split(" ");
    return { tool: "send_sms", params: { to, message: rest.join(" ") } };
  }

  return null;
}

async function postSlackResponse(url: string, text: string): Promise<void> {
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ response_type: "in_channel", text }),
  }).catch((err) => console.error("[slack] response_url error:", err));
}

// POST /slack/command — receives Slack /gojo slash command
router.post("/command", async (req, res) => {
  const { text = "", response_url, user_name } = req.body as {
    text: string;
    response_url: string;
    user_name: string;
  };

  // Slack requires response within 3 seconds
  res.json({
    response_type: "in_channel",
    text: `*@gojo is on it, ${user_name}…* \`${text}\``,
  });

  const parsed = parseGojoCommand(text);
  if (!parsed) {
    await postSlackResponse(
      response_url,
      [
        "*@gojo* — available commands:",
        "• `sql SELECT ...` — run a read-only SQL query",
        "• `logs` / `logs function` — fetch recent logs",
        "• `storage` — list InsForge buckets",
        "• `analyze <question>` — AI analysis via Gemini",
        "• `code <task>` — spawn Replicas coding agent",
        "• `sms +1... message` — send Twilio SMS",
      ].join("\n")
    );
    return;
  }

  try {
    const result = await executeTool(parsed.tool, parsed.params);
    const preview = String(result.diff).substring(0, 1800);
    await postSlackResponse(
      response_url,
      `*@gojo done* ✅ \`${parsed.tool}\`\n\`\`\`\n${preview}\n\`\`\``
    );
  } catch (err) {
    await postSlackResponse(
      response_url,
      `*@gojo error* ❌ \`${parsed.tool}\`\n>${(err as Error).message}`
    );
  }
});

export { router as slackRouter };
