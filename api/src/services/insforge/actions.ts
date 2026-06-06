import { execFile } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import twilio from "twilio";
import { GoogleGenAI } from "@google/genai";
import { promisify } from "util";
import { config } from "../../config.js";
import { createDevinSession, pollDevinSession, sendDevinMessage } from "../devin/client.js";
import { broadcastEvent } from "./realtime.js";

export type ActionResult = { result: unknown; diff: string; action: string; sponsor?: string; narration?: string; sessionId?: string; prUrl?: string };
const execFileAsync = promisify(execFile);

export async function executeTool(name: string, params: Record<string, string>): Promise<ActionResult> {
  switch (name) {
    case "run_sql":            return runSqlQuery(params.sql ?? "");
    case "add_index":          return addIndex(params.table ?? "", params.column ?? "");
    case "deploy_edge_fn":     return deployEdgeFn(params.slug ?? "", params.code ?? "");
    case "get_logs":           return getLogs((params.source ?? "insforge.logs") as "insforge.logs" | "function.logs");
    case "check_storage":      return checkStorage();
    case "send_sms":           return sendSms(params.to ?? "", params.message ?? "");
    case "spawn_coding_agent": return spawnCodingAgent(params.task ?? "");
    case "analyze_with_ai":    return analyzeWithAI(params.question ?? "", params.data ?? "");
    case "send_slack":          return sendSlack(params.message ?? "");
    case "spawn_devin_agent":   return spawnDevinAgent(params.task ?? "", params.title, params.callSid);
    case "send_agent_message":  return sendAgentMessage(params.sessionId ?? "", params.message ?? "");
    default: throw new Error(`Unknown tool: ${name}`);
  }
}

function assertIdentifier(value: string, label: string): void {
  if (!/^[a-zA-Z0-9_]+$/.test(value)) {
    throw new Error(`Security: ${label} must be alphanumeric/underscore, got: ${JSON.stringify(value)}`);
  }
}

function assertSlug(value: string, label: string): void {
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
    throw new Error(`Security: ${label} must be alphanumeric/hyphen/underscore, got: ${JSON.stringify(value)}`);
  }
}

function parseJsonOrLines(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw.trim().split("\n").slice(-20);
  }
}

async function cli(...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("npx", ["@insforge/cli", ...args], {
    encoding: "utf8",
    timeout: 15000,
    maxBuffer: 4 * 1024 * 1024,
  });
  return stdout;
}

// Active Devin sessions for routing (sessionId → callSid)
export const activeDevinSessions = new Map<string, { callSid: string; task: string; num: number }>();
let devinSessionSeq = 0;

const TOOL_SPONSORS: Record<string, string> = {
  run_sql:            "InsForge · Postgres",
  add_index:          "InsForge · Postgres",
  deploy_edge_fn:     "InsForge · Edge Functions",
  get_logs:           "InsForge · Logs",
  check_storage:      "InsForge · Storage",
  send_sms:           "Twilio · SMS",
  spawn_coding_agent: "Replicas · Coding Agent",
  analyze_with_ai:    "Gemini · AI Gateway",
  send_slack:         "Slack · Webhooks",
  spawn_devin_agent:  "Devin · Cognition AI",
  send_agent_message: "Devin · Cognition AI",
};

export function getSponsor(tool: string): string {
  return TOOL_SPONSORS[tool] ?? "Unknown";
}

async function runSqlQuery(sql: string): Promise<ActionResult> {
  const trimmed = sql.trim();
  if (!trimmed.toLowerCase().startsWith("select")) {
    throw new Error("Security: only SELECT queries are allowed");
  }
  if (trimmed.includes(";")) {
    throw new Error("Security: multi-statement SQL is not allowed");
  }

  const output = await cli("db", "query", trimmed, "--json");
  const rows = parseJsonOrLines(output);
  const count = Array.isArray(rows) ? rows.length : "?";
  return {
    action: "run_sql",
    result: rows,
    diff: `-- SQL Query\n${trimmed}\n\n-- Result: ${count} row(s)`,
  };
}

async function addIndex(table: string, column: string): Promise<ActionResult> {
  assertIdentifier(table, "table");
  assertIdentifier(column, "column");

  const indexName = `idx_${table}_${column}`;
  const sql = `CREATE INDEX IF NOT EXISTS ${indexName} ON ${table}(${column});`;
  await cli("db", "query", sql);

  return {
    action: "add_index",
    result: { indexName, table, column, status: "created" },
    diff: sql,
  };
}

async function deployEdgeFn(slug: string, code: string): Promise<ActionResult> {
  assertSlug(slug, "slug");

  const tmpFile = join(tmpdir(), `${slug}-${Date.now()}.ts`);
  writeFileSync(tmpFile, code, "utf8");

  try {
    await execFileAsync("npx", ["@insforge/cli", "functions", "deploy", slug, "--file", tmpFile], {
      encoding: "utf8",
      timeout: 30000,
      maxBuffer: 4 * 1024 * 1024,
    });
  } finally {
    try { unlinkSync(tmpFile); } catch { /* ignore */ }
  }

  return {
    action: "deploy_edge_fn",
    result: { slug, status: "deployed" },
    diff: `// Deployed: ${slug}\n\n${code}`,
  };
}

const VALID_LOG_SOURCES = new Set(["insforge.logs", "function.logs"]);

async function getLogs(source: "insforge.logs" | "function.logs"): Promise<ActionResult> {
  if (!VALID_LOG_SOURCES.has(source)) {
    throw new Error(`Security: invalid log source: ${JSON.stringify(source)}`);
  }
  const output = await cli("logs", source, "--limit", "20", "--json");
  const logs = parseJsonOrLines(output);
  return {
    action: "get_logs",
    result: logs,
    diff: `-- Recent logs from ${source}\n${typeof logs === "string" ? logs : JSON.stringify(logs, null, 2)}`,
  };
}

async function checkStorage(): Promise<ActionResult> {
  const output = await cli("storage", "list", "--json");
  const buckets = parseJsonOrLines(output);
  return {
    action: "check_storage",
    result: buckets,
    diff: `-- InsForge Storage\n${JSON.stringify(buckets, null, 2)}`,
    sponsor: "InsForge · Storage",
  };
}

async function sendSms(to: string, message: string): Promise<ActionResult> {
  if (!/^\+[1-9]\d{6,14}$/.test(to)) {
    throw new Error(`Security: invalid E.164 phone number: ${JSON.stringify(to)}`);
  }
  if (message.length > 1600) {
    throw new Error("Security: message too long (max 1600 chars)");
  }

  const twilioClient = twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);
  const msg = await twilioClient.messages.create({
    to,
    from: config.TWILIO_PHONE_NUMBER,
    body: message,
  });

  return {
    action: "send_sms",
    result: { messageSid: msg.sid, to, status: msg.status },
    diff: `-- Twilio SMS\nTO:   ${to}\nFROM: ${config.TWILIO_PHONE_NUMBER}\nSID:  ${msg.sid}\n\n${message}`,
    sponsor: "Twilio · SMS",
  };
}

async function spawnCodingAgent(task: string): Promise<ActionResult> {
  const apiKey = config.REPLICAS_API_KEY;
  if (!apiKey) throw new Error("REPLICAS_API_KEY not configured");

  const spawnBody: Record<string, string> = { message: task, coding_agent: "claude" };
  if (config.REPLICAS_ORG_ID) spawnBody.organization_id = config.REPLICAS_ORG_ID;

  const spawnRes = await fetch("https://api.tryreplicas.com/v1/replica", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(spawnBody),
  });

  if (!spawnRes.ok) {
    const text = await spawnRes.text();
    throw new Error(`Replicas spawn error ${spawnRes.status}: ${text}`);
  }

  const spawnData = (await spawnRes.json()) as { id: string; url?: string };
  const agentId = spawnData.id;
  const agentUrl = spawnData.url ?? `https://app.tryreplicas.com/replicas/${agentId}`;

  // Notify Slack immediately — don't wait for completion
  void notifySlackInternal(
    `*:robot_face: Replicas agent spawned* (\`${agentId}\`)\nOrg: \`${config.REPLICAS_ORG_ID ?? "default"}\`\nTask: ${task}\n<${agentUrl}|View agent>`
  );

  // Poll up to 30s (10 × 3s) — cap to avoid blocking the voice call
  let agentResult: { diff?: string; filesChanged?: string[]; status?: string; url?: string } = {};
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const pollRes = await fetch(`https://api.tryreplicas.com/v1/replicas/${agentId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!pollRes.ok) {
      console.error(`[replicas] poll ${i} status ${pollRes.status}`);
      if (pollRes.status >= 400 && pollRes.status < 500) break;
      continue;
    }
    const data = (await pollRes.json()) as typeof agentResult;
    if (data.status === "completed" || data.diff) {
      agentResult = data;
      break;
    }
  }

  const diff = agentResult.diff ?? `// Replicas agent ${agentId} — running\n// Task: ${task}\n// Track: ${agentUrl}`;
  const files = agentResult.filesChanged ?? [];
  const narration = await generateNarration(task, diff, files);

  // Notify Slack on completion (if it finished within poll window)
  if (agentResult.status === "completed" || agentResult.diff) {
    const preview = diff.substring(0, 500);
    void notifySlackInternal(
      `*:white_check_mark: Replicas agent done* (\`${agentId}\`)\nTask: ${task}\nFiles: ${files.join(", ") || "none"}\n\`\`\`\n${preview}\n\`\`\``
    );
  } else {
    // Still running — post background completion in Slack when it finishes
    void pollReplicasToCompletion(apiKey, agentId, task, agentUrl);
  }

  return {
    action: "spawn_coding_agent",
    result: { agentId, agentUrl, filesChanged: files, status: agentResult.status ?? "running" },
    diff: `// Replicas Coding Agent — ${agentId}\n// Org: ${config.REPLICAS_ORG_ID ?? "default"}\n// Task: ${task}\n// Track: ${agentUrl}\n\n${diff}`,
    sponsor: "Replicas · Coding Agent",
    narration,
  };
}

async function pollReplicasToCompletion(
  apiKey: string,
  agentId: string,
  task: string,
  agentUrl: string,
  timeoutMs = 300_000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let delay = 5000;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 1.5, 20_000);

    try {
      const res = await fetch(`https://api.tryreplicas.com/v1/replicas/${agentId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) continue;

      const data = (await res.json()) as { diff?: string; filesChanged?: string[]; status?: string };
      if (data.status === "completed" || data.diff) {
        const preview = (data.diff ?? "").substring(0, 500);
        const files = data.filesChanged ?? [];
        await notifySlackInternal(
          `*:white_check_mark: Replicas agent done* (\`${agentId}\`)\nTask: ${task}\nFiles: ${files.join(", ") || "none"}\n<${agentUrl}|View>\n\`\`\`\n${preview}\n\`\`\``
        );
        return;
      }
    } catch (err) {
      console.error(`[replicas] background poll error:`, err);
    }
  }

  void notifySlackInternal(`*:hourglass: Replicas agent \`${agentId}\` still running after 5min*\nTask: ${task}\n<${agentUrl}|View>`);
}

async function sendSlack(message: string): Promise<ActionResult> {
  const webhookUrl = config.SLACK_WEBHOOK_URL;
  if (!webhookUrl) throw new Error("SLACK_WEBHOOK_URL not configured");

  const payload = {
    text: `*Gojo Alert*\n${message}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*:robot_face: Gojo Alert*\n${message}`,
        },
      },
    ],
  };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Slack webhook HTTP ${res.status}`);

  return {
    action: "send_slack",
    result: { status: "delivered" },
    diff: `-- Slack Notification\n${message}`,
    sponsor: "Slack · Webhooks",
  };
}

async function spawnDevinAgent(task: string, title?: string, callSid?: string): Promise<ActionResult> {
  const session = await createDevinSession(task, { title });

  devinSessionSeq++;
  const num = devinSessionSeq;
  const sid = callSid ?? "unknown";

  activeDevinSessions.set(session.session_id, { callSid: sid, task, num });

  // Broadcast start event (non-blocking — we don't await the full poll)
  void broadcastEvent({
    type: "devin_agent_started",
    callSid: sid,
    sessionId: session.session_id,
    sessionUrl: session.url,
    task,
  }).catch((err) => console.error("[devin] broadcast start error:", err));

  // Poll in background — don't block the voice call
  void pollDevinSession(
    session.session_id,
    async (s) => {
      const narration = s.status_detail ?? `Agent ${num} status: ${s.status}`;
      await broadcastEvent({
        type: "devin_agent_update",
        callSid: sid,
        sessionId: session.session_id,
        narration,
      }).catch(() => { /* ignore */ });
    },
    120_000
  ).then(async (final) => {
    const prUrl = final.pull_requests?.[0]?.url;
    const narration = await generateNarration(task, "", []);
    await broadcastEvent({
      type: "devin_agent_done",
      callSid: sid,
      sessionId: session.session_id,
      sessionUrl: final.url,
      narration: narration || `Agent ${num} completed: ${task}`,
      prUrl,
    }).catch(() => { /* ignore */ });

    if (config.SLACK_WEBHOOK_URL) {
      await notifySlackInternal(
        `*@gojo Devin agent done* (Agent ${num})\nTask: ${task}\n${prUrl ? `PR: ${prUrl}` : "No PR opened"}`
      );
    }
    activeDevinSessions.delete(session.session_id);
  }).catch((err) => console.error(`[devin] poll error for ${session.session_id}:`, err));

  return {
    action: "spawn_devin_agent",
    result: { sessionId: session.session_id, sessionUrl: session.url, status: "spawned" },
    diff: `// Devin Agent ${num} — ${session.session_id}\n// Task: ${task}\n// View live: ${session.url}`,
    sponsor: "Devin · Cognition AI",
    sessionId: session.session_id,
  };
}

async function sendAgentMessage(sessionId: string, message: string): Promise<ActionResult> {
  await sendDevinMessage(sessionId, message);
  const entry = activeDevinSessions.get(sessionId);
  if (entry && config.SLACK_WEBHOOK_URL) {
    await notifySlackInternal(`*@gojo → Agent ${entry.num}*\n"${message}"`);
  }
  return {
    action: "send_agent_message",
    result: { sessionId, status: "delivered" },
    diff: `// Follow-up to Devin session ${sessionId}\n// Message: ${message}`,
    sponsor: "Devin · Cognition AI",
  };
}

async function generateNarration(task: string, diff: string, _files: string[]): Promise<string> {
  try {
    const ai = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });
    const prompt = `In exactly one sentence (max 20 words), describe what this coding task does for a non-technical audience.\nTask: ${task}\nDiff preview: ${diff.substring(0, 300)}`;
    const res = await ai.models.generateContent({ model: "gemini-2.0-flash", contents: prompt });
    return res.text?.trim() ?? "";
  } catch {
    return "";
  }
}

async function notifySlackInternal(message: string): Promise<void> {
  const webhookUrl = config.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;
  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: message }),
  }).catch((err) => console.error("[slack] notify error:", err));
}

async function analyzeWithAI(question: string, data: string): Promise<ActionResult> {
  const ai = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });

  const prompt = `You are an expert infrastructure engineer. Analyze the following data and answer the question concisely.

Question: ${question}

Data:
${data.substring(0, 4000)}

Provide:
1. Direct answer to the question
2. Key findings or anomalies
3. Recommended next action (if any)

Be specific and technical. Limit to 200 words.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: prompt,
  });

  const analysis = response.text ?? "No analysis returned";

  return {
    action: "analyze_with_ai",
    result: { question, analysis },
    diff: `-- Gemini AI Analysis\n-- Question: ${question}\n\n${analysis}`,
    sponsor: "Gemini · AI Gateway",
  };
}
