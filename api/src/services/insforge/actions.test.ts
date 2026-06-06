import { describe, it, expect, vi } from "vitest";

// Mock config before importing actions
vi.mock("../../config.js", () => ({
  config: {
    GEMINI_API_KEY: "test-key",
    GEMINI_MODEL: "gemini-3.1-flash-live-preview",
    GEMINI_VOICE: "Puck",
    TWILIO_ACCOUNT_SID: "AC_test",
    TWILIO_AUTH_TOKEN: "auth_test",
    TWILIO_PHONE_NUMBER: "+10000000000",
    TWILIO_WEBHOOK_BASE: "https://test.ngrok.io",
    INSFORGE_URL: "https://test.insforge.app",
    INSFORGE_KEY: "ik_test",
    REPLICAS_API_KEY: "rep_test",
    SLACK_WEBHOOK_URL: "https://hooks.slack.com/test",
    NODE_ENV: "test",
    PORT: 3000,
  },
}));

// Mock child_process so we don't actually run CLI commands
vi.mock("child_process", () => ({
  execFileSync: vi.fn(() => '[]'),
}));

// Mock twilio
vi.mock("twilio", () => ({
  default: vi.fn(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({ sid: "SM_test", status: "queued" }),
    },
  })),
}));

// Mock @google/genai
vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: {
      generateContent: vi.fn().mockResolvedValue({ text: "Test analysis" }),
    },
  })),
}));

import { executeTool, getSponsor } from "./actions";
import { execFileSync } from "child_process";

describe("actions", () => {
  describe("getSponsor", () => {
    it("returns correct sponsor for known tools", () => {
      expect(getSponsor("run_sql")).toBe("InsForge · Postgres");
      expect(getSponsor("send_sms")).toBe("Twilio · SMS");
      expect(getSponsor("spawn_coding_agent")).toBe("Replicas · Coding Agent");
      expect(getSponsor("analyze_with_ai")).toBe("Gemini · AI Gateway");
      expect(getSponsor("send_slack")).toBe("Slack · Webhooks");
    });

    it("returns 'Unknown' for unrecognized tool", () => {
      expect(getSponsor("nonexistent_tool")).toBe("Unknown");
    });
  });

  describe("executeTool — run_sql", () => {
    it("rejects non-SELECT queries", async () => {
      await expect(executeTool("run_sql", { sql: "DROP TABLE users" }))
        .rejects.toThrow("Security: only SELECT queries are allowed");
    });

    it("rejects INSERT queries", async () => {
      await expect(executeTool("run_sql", { sql: "INSERT INTO users VALUES (1)" }))
        .rejects.toThrow("Security: only SELECT queries are allowed");
    });

    it("rejects UPDATE queries", async () => {
      await expect(executeTool("run_sql", { sql: "UPDATE users SET name='x'" }))
        .rejects.toThrow("Security: only SELECT queries are allowed");
    });

    it("rejects DELETE queries", async () => {
      await expect(executeTool("run_sql", { sql: "DELETE FROM users" }))
        .rejects.toThrow("Security: only SELECT queries are allowed");
    });

    it("rejects multi-statement SQL", async () => {
      await expect(executeTool("run_sql", { sql: "SELECT 1; DROP TABLE users" }))
        .rejects.toThrow("Security: multi-statement SQL is not allowed");
    });

    it("allows SELECT queries (case-insensitive)", async () => {
      vi.mocked(execFileSync).mockReturnValue('[{"id": 1}]');
      const result = await executeTool("run_sql", { sql: "SELECT * FROM voice_calls" });
      expect(result.action).toBe("run_sql");
      expect(result.diff).toContain("SELECT * FROM voice_calls");
    });

    it("handles lowercase select", async () => {
      vi.mocked(execFileSync).mockReturnValue("[]");
      const result = await executeTool("run_sql", { sql: "select count(*) from events" });
      expect(result.action).toBe("run_sql");
    });

    it("handles whitespace-prefixed queries", async () => {
      vi.mocked(execFileSync).mockReturnValue("[]");
      const result = await executeTool("run_sql", { sql: "  SELECT 1" });
      expect(result.action).toBe("run_sql");
    });
  });

  describe("executeTool — add_index", () => {
    it("rejects table names with special characters", async () => {
      await expect(executeTool("add_index", { table: "users; DROP", column: "id" }))
        .rejects.toThrow("Security: table must be alphanumeric/underscore");
    });

    it("rejects column names with special characters", async () => {
      await expect(executeTool("add_index", { table: "users", column: "id--" }))
        .rejects.toThrow("Security: column must be alphanumeric/underscore");
    });

    it("allows valid identifiers", async () => {
      vi.mocked(execFileSync).mockReturnValue("");
      const result = await executeTool("add_index", { table: "voice_calls", column: "call_sid" });
      expect(result.action).toBe("add_index");
      expect(result.diff).toContain("idx_voice_calls_call_sid");
    });
  });

  describe("executeTool — deploy_edge_fn", () => {
    it("rejects slugs with special characters", async () => {
      await expect(executeTool("deploy_edge_fn", { slug: "fn;rm -rf", code: "export default {}" }))
        .rejects.toThrow("Security: slug must be alphanumeric/hyphen/underscore");
    });

    it("allows valid slugs with hyphens", async () => {
      vi.mocked(execFileSync).mockReturnValue("");
      const result = await executeTool("deploy_edge_fn", { slug: "my-function", code: "export default {}" });
      expect(result.action).toBe("deploy_edge_fn");
      expect(result.diff).toContain("my-function");
    });
  });

  describe("executeTool — send_sms", () => {
    it("rejects invalid phone numbers", async () => {
      await expect(executeTool("send_sms", { to: "not-a-number", message: "hi" }))
        .rejects.toThrow("Security: invalid E.164 phone number");
    });

    it("rejects numbers without + prefix", async () => {
      await expect(executeTool("send_sms", { to: "19255155725", message: "hi" }))
        .rejects.toThrow("Security: invalid E.164 phone number");
    });

    it("rejects messages over 1600 chars", async () => {
      const longMsg = "x".repeat(1601);
      await expect(executeTool("send_sms", { to: "+19255155725", message: longMsg }))
        .rejects.toThrow("Security: message too long");
    });

    it("accepts valid E.164 numbers", async () => {
      const result = await executeTool("send_sms", { to: "+19255155725", message: "Test" });
      expect(result.action).toBe("send_sms");
    });
  });

  describe("executeTool — unknown tool", () => {
    it("throws for unknown tool names", async () => {
      await expect(executeTool("nonexistent", {}))
        .rejects.toThrow("Unknown tool: nonexistent");
    });
  });
});
