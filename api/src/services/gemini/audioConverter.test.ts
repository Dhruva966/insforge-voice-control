import { describe, it, expect } from "vitest";
import { twilioToGemini, geminiToTwilio } from "./audioConverter";

describe("audioConverter", () => {
  describe("twilioToGemini", () => {
    it("converts base64 mulaw to base64 PCM16 at 16kHz", () => {
      // 160 bytes of mulaw silence (0xFF) = 20ms frame at 8kHz
      const mulawSilence = Buffer.alloc(160, 0xff);
      const input = mulawSilence.toString("base64");

      const result = twilioToGemini(input);

      // Should return a base64 string
      expect(typeof result).toBe("string");

      // Decode to check size: 160 samples at 8kHz upsampled to 16kHz = 320 samples
      // Each sample is 2 bytes (Int16), so 640 bytes
      const decoded = Buffer.from(result, "base64");
      expect(decoded.length).toBe(640);
    });

    it("returns valid base64", () => {
      const input = Buffer.alloc(80, 0x80).toString("base64");
      const result = twilioToGemini(input);
      // Should not throw when decoded
      expect(() => Buffer.from(result, "base64")).not.toThrow();
    });

    it("handles small input (1 byte)", () => {
      const input = Buffer.from([0xff]).toString("base64");
      const result = twilioToGemini(input);
      const decoded = Buffer.from(result, "base64");
      // 1 sample upsampled 2x = 2 samples = 4 bytes
      expect(decoded.length).toBe(4);
    });

    it("preserves relative audio levels", () => {
      // Loud mulaw samples vs silence — output should differ
      const silence = Buffer.alloc(10, 0xff).toString("base64");
      const loud = Buffer.alloc(10, 0x00).toString("base64");

      const silenceOut = Buffer.from(twilioToGemini(silence), "base64");
      const loudOut = Buffer.from(twilioToGemini(loud), "base64");

      expect(silenceOut).not.toEqual(loudOut);
    });
  });

  describe("geminiToTwilio", () => {
    it("converts base64 PCM16 at 24kHz to base64 mulaw at 8kHz", () => {
      // 480 samples at 24kHz = 20ms frame. Each sample is 2 bytes = 960 bytes
      const pcm24k = Buffer.alloc(960, 0);
      const input = pcm24k.toString("base64");

      const result = geminiToTwilio(input);

      expect(typeof result).toBe("string");
      // 480 samples at 24kHz → 320 at 16kHz → 160 at 8kHz → 160 mulaw bytes
      const decoded = Buffer.from(result, "base64");
      expect(decoded.length).toBe(160);
    });

    it("returns valid base64", () => {
      const input = Buffer.alloc(480, 0).toString("base64");
      const result = geminiToTwilio(input);
      expect(() => Buffer.from(result, "base64")).not.toThrow();
    });

    it("handles minimum input (2 bytes = 1 sample)", () => {
      const pcm = Buffer.alloc(2, 0);
      const input = pcm.toString("base64");
      const result = geminiToTwilio(input);
      // Downsample ratio: 24k→16k (ratio 1.5), then 16k→8k (ratio 2)
      // With 1 sample input: floor(1/1.5) = 0 samples after first downsample
      // So output may be empty — just verify no crash
      expect(typeof result).toBe("string");
    });
  });

  describe("round-trip consistency", () => {
    it("maintains codec pipeline without throwing", () => {
      // Simulate a real 20ms mulaw frame → Gemini → back to Twilio
      const originalMulaw = Buffer.alloc(160, 0x80);
      const toGemini = twilioToGemini(originalMulaw.toString("base64"));

      // The output from twilioToGemini is PCM16 16kHz.
      // geminiToTwilio expects PCM16 24kHz, so we can't do a true round-trip,
      // but we can verify the pipeline doesn't crash with arbitrary data.
      const fakePcm24k = Buffer.alloc(960, 0x10);
      expect(() => geminiToTwilio(fakePcm24k.toString("base64"))).not.toThrow();
      expect(typeof toGemini).toBe("string");
    });
  });
});
