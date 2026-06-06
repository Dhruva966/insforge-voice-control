import { Modality, StartSensitivity, EndSensitivity } from "@google/genai";
import { config } from "../../config";
import { twilioToGemini, geminiToTwilio } from "./audioConverter";
import { ai } from "./client";
import { INSFORGE_TOOLS } from "./tools";
import { INSFORGE_AGENT_SYSTEM } from "./systemPrompt";
import { executeTool, getSponsor, activeDevinSessions } from "../insforge/actions";
import { broadcastEvent } from "../insforge/realtime";
import { routeTranscript } from "../devin/router";
import type { AlertContext } from "../alert/store";

export interface GeminiHandle {
  sendAudio: (base64Mulaw: string) => void;
  close: () => void;
  actionCount: number;
}

interface Transcription {
  finished?: boolean;
  text?: string;
}

function broadcastTranscript(
  transcript: Transcription | undefined,
  callSid: string,
  role: "user" | "agent"
): void {
  if (!transcript?.finished || !transcript.text?.trim()) return;
  void broadcastEvent({
    type: "transcript",
    callSid,
    role,
    text: transcript.text.trim(),
    timestamp: new Date().toISOString(),
  }).catch((err) => console.error(`[${callSid}] ${role} transcript broadcast error:`, err));
}

export async function openGeminiSession(
  callSid: string,
  onAudio: (base64Mulaw: string) => void,
  onError: (err: Error) => void,
  onToolCallStart: () => void,
  alertCtx?: AlertContext
): Promise<GeminiHandle> {
  let actionCount = 0;

  const liveSession = await ai.live.connect({
    model: config.GEMINI_MODEL,
    config: {
      responseModalities: [Modality.AUDIO],
      systemInstruction: { parts: [{ text: INSFORGE_AGENT_SYSTEM }] },
      temperature: 0,
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: config.GEMINI_VOICE } },
        languageCode: "en-US",
      },
      tools: [{ functionDeclarations: INSFORGE_TOOLS }],
      realtimeInputConfig: {
        automaticActivityDetection: {
          disabled: false,
          startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_LOW,
          endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
          silenceDurationMs: 700,
        },
      },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
    },
    callbacks: {
      onmessage: async (msg) => {
        if (msg.data) {
          onAudio(geminiToTwilio(msg.data));
        }

        // User transcript — inline because Devin agent routing needs the text value
        const userTranscript = msg.serverContent?.inputTranscription;
        if (userTranscript?.finished && userTranscript.text?.trim()) {
          const text = userTranscript.text.trim();
          broadcastTranscript(userTranscript, callSid, "user");

          // Route transcript to relevant Devin agents if any are running
          const runningAgents = [...activeDevinSessions.entries()]
            .filter(([, v]) => v.callSid === callSid)
            .map(([sessionId, v]) => ({ sessionId, task: v.task, num: v.num, status: "running" }));

          if (runningAgents.length > 0) {
            void routeTranscript(text, runningAgents).then(async (decision) => {
              if (!decision || decision.confidence !== "high") return;
              const entry = activeDevinSessions.get(decision.sessionId);
              if (!entry) return;
              await broadcastEvent({
                type: "agent_routed",
                callSid,
                sessionId: decision.sessionId,
                agentNum: entry.num,
                instruction: decision.instruction,
              }).catch(() => { /* ignore */ });
            }).catch(() => { /* non-critical */ });
          }
        }

        broadcastTranscript(msg.serverContent?.outputTranscription, callSid, "agent");

        if (msg.toolCall?.functionCalls?.length) {
          onToolCallStart();

          const responses = [];
          for (const call of msg.toolCall.functionCalls) {
            const { name, args, id } = call;
            const params = (args ?? {}) as Record<string, string>;

            const sponsor = getSponsor(name ?? "");

            await broadcastEvent({
              type: "action_proposed",
              callSid,
              action: name ?? "",
              params,
              diff: JSON.stringify(params, null, 2),
              sponsor,
            });

            await broadcastEvent({ type: "action_executing", callSid, action: name ?? "", sponsor });

            const start = Date.now();
            let actionResult: Awaited<ReturnType<typeof executeTool>> | null = null;
            let success = true;
            try {
              actionResult = await executeTool(name ?? "", params);
              actionCount++;
            } catch (err) {
              actionResult = { action: name ?? "", result: { error: String(err) }, diff: String(err), sponsor };
              success = false;
            }
            const durationMs = Date.now() - start;

            await broadcastEvent({
              type: "action_done",
              callSid,
              action: name ?? "",
              result: JSON.stringify(actionResult.result),
              success,
              durationMs,
              sponsor,
              diff: actionResult.diff,
            });

            responses.push({
              id: id ?? "",
              name: name ?? "",
              response: { output: actionResult.result },
            });
          }

          liveSession.sendToolResponse({ functionResponses: responses });
        }
      },
      onerror: (err) => onError(err instanceof Error ? err : new Error(String(err))),
      onclose: () => console.log(`[${callSid}] Gemini session closed`),
    },
  });

  if (alertCtx) {
    // Alert call — Gojo called the engineer about a production error
    liveSession.sendRealtimeInput({
      text: `[ALERT CALL. You called this engineer about a production error. Introduce yourself briefly, then give ONE sentence summarizing the error. Do NOT read out the full stack trace or details unless the engineer asks. Say: "Hey, Gojo here — there's a ${alertCtx.errorType} in ${alertCtx.file}. Say 'details' for more, or 'fix it' to spawn an agent."]`,
    });
  } else {
    liveSession.sendRealtimeInput({
      text: "[Call connected. Say exactly: 'InsForge Control online — Postgres, Edge Functions, Realtime, and AI all standing by. What do you need?']",
    });
  }

  return {
    sendAudio: (base64Mulaw: string) => {
      liveSession.sendRealtimeInput({
        audio: { data: twilioToGemini(base64Mulaw), mimeType: "audio/pcm;rate=16000" },
      });
    },
    close: () => {
      try { liveSession.close(); } catch { /* ignore */ }
    },
    get actionCount() { return actionCount; },
  };
}
