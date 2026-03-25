import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { Client } from "pg";

async function loadLocalEnvFile(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) continue;
      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // Ignore missing local env files.
  }
}

async function loadLocalEnv() {
  const cwd = process.cwd();
  await loadLocalEnvFile(path.join(cwd, ".env.local"));
  await loadLocalEnvFile(path.join(cwd, ".env"));
}

function getConnectionString() {
  const direct = process.env.SUPABASE_POOLER_CONNECTION?.trim();
  if (direct) return direct;

  const dbUrl = process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim();
  if (dbUrl) return dbUrl;

  throw new Error("No Supabase/Postgres connection string found in env.");
}

async function main() {
  await loadLocalEnv();
  const [fileArg] = process.argv.slice(2);
  if (!fileArg) {
    throw new Error("Usage: npm run db:apply-sql -- <path-to-sql-file>");
  }

  const filePath = path.resolve(process.cwd(), fileArg);
  const sql = await fs.readFile(filePath, "utf8");
  if (!sql.trim()) {
    throw new Error(`SQL file is empty: ${fileArg}`);
  }

  const client = new Client({
    connectionString: getConnectionString(),
    ssl: {
      rejectUnauthorized: false,
    },
  });

  await client.connect();
  try {
    const result = await client.query(sql);
    const rowCount = typeof result.rowCount === "number" ? result.rowCount : 0;
    console.log(`Applied SQL from ${fileArg}`);
    console.log(`Command: ${result.command ?? "UNKNOWN"}`);
    console.log(`Row count: ${rowCount}`);
    if (Array.isArray(result.rows) && result.rows.length > 0) {
      console.log(JSON.stringify(result.rows, null, 2));
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
