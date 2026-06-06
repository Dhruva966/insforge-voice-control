import type { FunctionDeclaration } from "@google/genai";

export const INSFORGE_TOOLS: FunctionDeclaration[] = [
  {
    name: "run_sql",
    description: "Execute a read-only SQL query on the InsForge Postgres database. SELECT only.",
    parameters: {
      type: "object" as const,
      properties: {
        sql: {
          type: "string" as const,
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
      type: "object" as const,
      properties: {
        table: { type: "string" as const, description: "Table name" },
        column: { type: "string" as const, description: "Column to index" },
      },
      required: ["table", "column"],
    },
  },
  {
    name: "deploy_edge_fn",
    description: "Deploy or update an InsForge edge function with TypeScript code",
    parameters: {
      type: "object" as const,
      properties: {
        slug: { type: "string" as const, description: "Function identifier/slug" },
        code: { type: "string" as const, description: "TypeScript function code" },
      },
      required: ["slug", "code"],
    },
  },
  {
    name: "get_logs",
    description: "Fetch recent logs from InsForge services",
    parameters: {
      type: "object" as const,
      properties: {
        source: {
          type: "string" as const,
          enum: ["insforge.logs", "function.logs"],
          description: "Log source to read",
        },
      },
      required: ["source"],
    },
  },
  {
    name: "check_storage",
    description: "List InsForge storage buckets and recent files",
    parameters: {
      type: "object" as const,
      properties: {},
    },
  },
];
