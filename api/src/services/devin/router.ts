import { GoogleGenAI } from "@google/genai";
import { config } from "../../config.js";

const ai = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });

export interface RunningAgent {
  sessionId: string;
  task: string;
  num: number;
  status: string;
}

export interface RoutingDecision {
  sessionId: string;
  instruction: string;
  confidence: "high" | "low";
}

/**
 * Uses Gemini Flash to analyze a voice transcript and route it to the most
 * relevant running agent. Returns null if no match found.
 */
export async function routeTranscript(
  transcript: string,
  runningAgents: RunningAgent[]
): Promise<RoutingDecision | null> {
  if (!runningAgents.length) return null;

  try {
    const agentList = runningAgents
      .map((a) => `Agent ${a.num} (id: ${a.sessionId}): "${a.task}"`)
      .join("\n");

    const prompt = `You are a routing agent for a multi-agent coding system. A user said something via voice while these coding agents are running:

Running agents:
${agentList}

User said: "${transcript}"

Decide which agent (if any) should receive a follow-up instruction based on what the user said.
Respond with ONLY valid JSON (no markdown, no explanation):
{ "sessionId": "<id>", "instruction": "<instruction under 50 words>", "confidence": "high" or "low" }
OR if no agent is relevant:
{ "sessionId": null }

Only route if you have HIGH confidence the user is directly addressing an agent's domain.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });

    const text = (response.text ?? "").trim().replace(/^```json\s*/, "").replace(/\s*```$/, "");
    const json = JSON.parse(text) as { sessionId?: string | null; instruction?: string; confidence?: string };

    if (!json.sessionId) return null;

    return {
      sessionId: json.sessionId,
      instruction: json.instruction ?? "",
      confidence: (json.confidence === "high" ? "high" : "low") as "high" | "low",
    };
  } catch (err) {
    console.error("[router] routeTranscript error:", err);
    return null;
  }
}
