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
          description: "Log source to read: 'insforge.logs' or 'function.logs'",
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
];
