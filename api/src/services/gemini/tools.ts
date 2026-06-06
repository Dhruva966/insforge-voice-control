import { Type } from "@google/genai";
import type { FunctionDeclaration } from "@google/genai";

export const INSFORGE_TOOLS: FunctionDeclaration[] = [
  {
    name: "run_sql",
    description: "Execute a read-only SQL query on the InsForge Postgres database. SELECT only.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        sql: {
          type: Type.STRING,
          description: "The SQL SELECT query to execute",
        },
      },
      required: ["sql"],
    },
  },
  {
    name: "add_index",
    description: "Add a database index to a table to improve query performance",
    parameters: {
      type: Type.OBJECT,
      properties: {
        table: { type: Type.STRING, description: "Table name" },
        column: { type: Type.STRING, description: "Column to index" },
      },
      required: ["table", "column"],
    },
  },
  {
    name: "deploy_edge_fn",
    description: "Deploy or update an InsForge edge function with TypeScript code",
    parameters: {
      type: Type.OBJECT,
      properties: {
        slug: { type: Type.STRING, description: "Function identifier/slug" },
        code: { type: Type.STRING, description: "TypeScript function code" },
      },
      required: ["slug", "code"],
    },
  },
  {
    name: "get_logs",
    description: "Fetch recent logs from InsForge services",
    parameters: {
      type: Type.OBJECT,
      properties: {
        source: {
          type: Type.STRING,
          description: "Log source to read",
          enum: ["insforge.logs", "function.logs"],
        },
      },
      required: ["source"],
    },
  },
  {
    name: "check_storage",
    description: "List InsForge storage buckets and recent files",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: "send_sms",
    description: "Send a Twilio SMS to the caller or any phone number — use to deliver summaries, alerts, or diffs after completing infra actions",
    parameters: {
      type: Type.OBJECT,
      properties: {
        to:      { type: Type.STRING, description: "Destination phone number in E.164 format, e.g. +14155551234" },
        message: { type: Type.STRING, description: "Text message body (up to 1600 chars; Twilio handles multi-segment automatically)" },
      },
      required: ["to", "message"],
    },
  },
  {
    name: "spawn_coding_agent",
    description: "Spawn a Replicas AI coding agent to write, refactor, or debug TypeScript/SQL code — use for migrations, edge function templates, or fix suggestions",
    parameters: {
      type: Type.OBJECT,
      properties: {
        task: { type: Type.STRING, description: "Plain-English description of the coding task" },
      },
      required: ["task"],
    },
  },
  {
    name: "analyze_with_ai",
    description: "Use the Gemini AI model to analyze query results, log output, or any data — produces optimization recommendations, anomaly detection, or plain-English summaries",
    parameters: {
      type: Type.OBJECT,
      properties: {
        question: { type: Type.STRING, description: "What to analyze or what question to answer" },
        data:     { type: Type.STRING, description: "The raw data, SQL results, or log lines to analyze" },
      },
      required: ["question", "data"],
    },
  },
  {
    name: "send_slack",
    description: "Send a Slack notification to the team channel via webhook — use to share diffs, summaries, alerts, or coding agent results. Also auto-triggered after spawn_coding_agent completes.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        message: {
          type: Type.STRING,
          description: "Notification message. Supports Slack mrkdwn formatting (*bold*, `code`, ```blocks```).",
        },
      },
      required: ["message"],
    },
  },
];
