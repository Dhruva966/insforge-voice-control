import { execSync } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { insforge } from "./client";

export type ActionResult = { result: unknown; diff: string; action: string };

export async function executeTool(name: string, params: Record<string, string>): Promise<ActionResult> {
  switch (name) {
    case "run_sql":    return runSqlQuery(params.sql ?? "");
    case "add_index":  return addIndex(params.table ?? "", params.column ?? "");
    case "deploy_edge_fn": return deployEdgeFn(params.slug ?? "", params.code ?? "");
    case "get_logs":   return getLogs((params.source ?? "insforge.logs") as "insforge.logs" | "function.logs");
    case "check_storage": return checkStorage();
    default: throw new Error(`Unknown tool: ${name}`);
  }
}

async function runSqlQuery(sql: string): Promise<ActionResult> {
  const trimmed = sql.trim();
  if (!trimmed.toLowerCase().startsWith("select")) {
    throw new Error("Security: only SELECT queries are allowed");
  }

  // ⚠️ verify DB accessor at hackathon: insforge.from vs insforge.database.from
  const client = insforge as {
    from?: (t: string) => { select: () => Promise<{ data: unknown[]; error: unknown }> };
    database?: { from: (t: string) => unknown };
  };

  // Use CLI for raw SQL (most reliable cross SDK-version approach)
  const output = execSync(`npx @insforge/cli db query ${JSON.stringify(trimmed)} --json`, {
    encoding: "utf8",
    timeout: 15000,
  });

  const rows = JSON.parse(output);
  return {
    action: "run_sql",
    result: rows,
    diff: `-- SQL Query\n${trimmed}\n\n-- Result: ${Array.isArray(rows) ? rows.length : "?"} row(s)`,
  };
}

async function addIndex(table: string, column: string): Promise<ActionResult> {
  const indexName = `idx_${table}_${column}`;
  const sql = `CREATE INDEX IF NOT EXISTS ${indexName} ON ${table}(${column});`;

  execSync(`npx @insforge/cli db query ${JSON.stringify(sql)}`, {
    encoding: "utf8",
    timeout: 15000,
  });

  return {
    action: "add_index",
    result: { indexName, table, column, status: "created" },
    diff: sql,
  };
}

async function deployEdgeFn(slug: string, code: string): Promise<ActionResult> {
  const tmpFile = join(tmpdir(), `${slug}-${Date.now()}.ts`);
  writeFileSync(tmpFile, code, "utf8");

  try {
    execSync(`npx @insforge/cli functions deploy ${slug} --file ${tmpFile}`, {
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

async function getLogs(source: "insforge.logs" | "function.logs"): Promise<ActionResult> {
  const output = execSync(`npx @insforge/cli logs ${source} --limit 20 --json`, {
    encoding: "utf8",
    timeout: 15000,
  });

  let logs: unknown;
  try {
    logs = JSON.parse(output);
  } catch {
    logs = output.trim().split("\n").slice(-20);
  }

  return {
    action: "get_logs",
    result: logs,
    diff: `-- Recent logs from ${source}\n${typeof logs === "string" ? logs : JSON.stringify(logs, null, 2)}`,
  };
}

async function checkStorage(): Promise<ActionResult> {
  const output = execSync(`npx @insforge/cli storage list --json`, {
    encoding: "utf8",
    timeout: 15000,
  });

  let buckets: unknown;
  try {
    buckets = JSON.parse(output);
  } catch {
    buckets = output.trim();
  }

  return {
    action: "check_storage",
    result: buckets,
    diff: `-- InsForge Storage\n${JSON.stringify(buckets, null, 2)}`,
  };
}
