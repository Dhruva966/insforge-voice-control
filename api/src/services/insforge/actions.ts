import { execFileSync } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

export type ActionResult = { result: unknown; diff: string; action: string };

export async function executeTool(name: string, params: Record<string, string>): Promise<ActionResult> {
  switch (name) {
    case "run_sql":        return runSqlQuery(params.sql ?? "");
    case "add_index":      return addIndex(params.table ?? "", params.column ?? "");
    case "deploy_edge_fn": return deployEdgeFn(params.slug ?? "", params.code ?? "");
    case "get_logs":       return getLogs((params.source ?? "insforge.logs") as "insforge.logs" | "function.logs");
    case "check_storage":  return checkStorage();
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

function cli(...args: string[]): string {
  return execFileSync("npx", ["@insforge/cli", ...args], { encoding: "utf8", timeout: 15000 });
}

async function runSqlQuery(sql: string): Promise<ActionResult> {
  const trimmed = sql.trim();
  if (!trimmed.toLowerCase().startsWith("select")) {
    throw new Error("Security: only SELECT queries are allowed");
  }
  if (trimmed.includes(";")) {
    throw new Error("Security: multi-statement SQL is not allowed");
  }

  const output = cli("db", "query", trimmed, "--json");
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
  cli("db", "query", sql);

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
    execFileSync("npx", ["@insforge/cli", "functions", "deploy", slug, "--file", tmpFile], {
      encoding: "utf8",
      timeout: 30000,
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
  const output = cli("logs", source, "--limit", "20", "--json");
  const logs = parseJsonOrLines(output);
  return {
    action: "get_logs",
    result: logs,
    diff: `-- Recent logs from ${source}\n${typeof logs === "string" ? logs : JSON.stringify(logs, null, 2)}`,
  };
}

async function checkStorage(): Promise<ActionResult> {
  const output = cli("storage", "list", "--json");
  const buckets = parseJsonOrLines(output);
  return {
    action: "check_storage",
    result: buckets,
    diff: `-- InsForge Storage\n${JSON.stringify(buckets, null, 2)}`,
  };
}
