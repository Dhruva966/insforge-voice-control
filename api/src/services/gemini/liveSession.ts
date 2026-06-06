import { GoogleGenAI, Modality, StartSensitivity, EndSensitivity } from "@google/genai";
import { config } from "../../config";
import { twilioToGemini, geminiToTwilio } from "./audioConverter";
import { INSFORGE_TOOLS } from "./tools";
import { INSFORGE_AGENT_SYSTEM } from "./systemPrompt";
import { executeTool } from "../insforge/actions";
import { broadcastEvent } from "../insforge/realtime";

export interface GeminiHandle {
  sendAudio: (base64Mulaw: string) => void;
  close: () => void;
  actionCount: number;
}

const ai = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });

export async function openGeminiSession(
  callSid: string,
  onAudio: (base64Mulaw: string) => void,
  onError: (err: Error) => void,
  onToolCallStart: () => void
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

        if (msg.serverContent?.outputTranscription?.text) {
          await broadcastEvent({
            type: "transcript",
            callSid,
            role: "agent",
            text: msg.serverContent.outputTranscription.text,
            timestamp: new Date().toISOString(),
          });
        }

        if (msg.toolCall?.functionCalls?.length) {
          onToolCallStart();

          const responses = [];
          for (const call of msg.toolCall.functionCalls) {
            const { name, args, id } = call;
            const params = (args ?? {}) as Record<string, string>;

            await broadcastEvent({
              type: "action_proposed",
              callSid,
              action: name ?? "",
              params,
              diff: JSON.stringify(params, null, 2),
            });

            await broadcastEvent({ type: "action_executing", callSid, action: name ?? "" });

            const start = Date.now();
            let result: unknown;
            let success = true;
            try {
              result = await executeTool(name ?? "", params);
              actionCount++;
            } catch (err) {
              result = { error: String(err) };
              success = false;
            }
            const durationMs = Date.now() - start;

            await broadcastEvent({
              type: "action_done",
              callSid,
              action: name ?? "",
              result: JSON.stringify(result),
              success,
              durationMs,
            });

            responses.push({
              id: id ?? "",
              name: name ?? "",
              response: { output: result },
            });
          }

          liveSession.sendToolResponse({ functionResponses: responses });
        }
      },
      onerror: (err) => onError(err instanceof Error ? err : new Error(String(err))),
      onclose: () => console.log(`[${callSid}] Gemini session closed`),
    },
  });

  liveSession.sendRealtimeInput({
    text: "[Call connected. Say exactly: 'InsForge Control online. What do you need?']",
  });

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
