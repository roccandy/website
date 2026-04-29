import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { Client } from "pg";
import {
  addRowsFromInsertSql,
  buildCustomerHistoryImport,
  getLegacyNewTargetTables,
  getLegacyOldTargetTables,
  type CustomerContactEventImportRecord,
  type CustomerHistoryImportData,
  type CustomerIdentityImportRecord,
  type CustomerImportRecord,
  type CustomerOrderHistoryImportRecord,
  type CustomerOrderItemImportRecord,
  type SqlRow,
  type SqlTableRows,
} from "../src/lib/customerHistoryImport";

type CliOptions = {
  apply: boolean;
  oldArchivePath: string;
  newArchivePath: string;
  includeCurrent: boolean;
};

type InsertableRecord = Record<string, unknown>;

const DEFAULT_OLD_ARCHIVE = "archive/roccandy-old-2026-04-29_08-23-42.sql.bz2";
const DEFAULT_NEW_ARCHIVE = "archive/roccandy-new-2026-04-29_08-26-29.sql 2.bz2";
const BATCH_SIZE = 200;

async function loadLocalEnvFile(filePath: string) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) continue;
      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // Missing local env files are expected in CI and dry-run-only environments.
  }
}

async function loadLocalEnv() {
  const cwd = process.cwd();
  await loadLocalEnvFile(path.join(cwd, ".env.local"));
  await loadLocalEnvFile(path.join(cwd, ".env"));
}

function getConnectionString() {
  return (
    process.env.SUPABASE_POOLER_CONNECTION?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    null
  );
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  let apply = false;
  let oldArchivePath = DEFAULT_OLD_ARCHIVE;
  let newArchivePath = DEFAULT_NEW_ARCHIVE;
  let includeCurrent = true;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    if (arg === "--apply") {
      apply = true;
      continue;
    }
    if (arg === "--dry-run") {
      apply = false;
      continue;
    }
    if (arg === "--skip-current") {
      includeCurrent = false;
      continue;
    }
    if (arg === "--old") {
      oldArchivePath = args[index + 1] ?? oldArchivePath;
      index += 1;
      continue;
    }
    if (arg === "--new") {
      newArchivePath = args[index + 1] ?? newArchivePath;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { apply, oldArchivePath, newArchivePath, includeCurrent };
}

function printHelp() {
  console.log(`Usage: npm run import-customer-history -- [--dry-run|--apply] [--old path] [--new path] [--skip-current]

Defaults:
  --dry-run
  --old ${DEFAULT_OLD_ARCHIVE}
  --new ${DEFAULT_NEW_ARCHIVE}

Dry-run parses the archive files and prints counts. --apply requires a Postgres connection string in
SUPABASE_POOLER_CONNECTION, DATABASE_URL, or POSTGRES_URL and upserts into the customer-history tables.`);
}

async function parseArchive(filePath: string, targetTables: Set<string>) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  await fs.access(absolutePath);
  const rows: SqlTableRows = {};
  const child = spawn("bzip2", ["-dc", absolutePath], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");

  let stderr = "";
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });

  let buffer = "";
  let collectingTable: string | null = null;
  let statement = "";

  const processLine = (line: string) => {
    if (!collectingTable) {
      const insertMatch = line.match(/^INSERT INTO `([^`]+)`/);
      if (!insertMatch || !targetTables.has(insertMatch[1])) return;
      collectingTable = insertMatch[1];
      statement = `${line}\n`;
      if (line.trim().endsWith(";")) {
        addRowsFromInsertSql(rows, statement);
        collectingTable = null;
        statement = "";
      }
      return;
    }

    statement += `${line}\n`;
    if (line.trim().endsWith(";")) {
      addRowsFromInsertSql(rows, statement);
      collectingTable = null;
      statement = "";
    }
  };

  for await (const chunk of child.stdout) {
    buffer += chunk;
    let lineEnd = buffer.indexOf("\n");
    while (lineEnd !== -1) {
      const line = buffer.slice(0, lineEnd);
      buffer = buffer.slice(lineEnd + 1);
      processLine(line);
      lineEnd = buffer.indexOf("\n");
    }
  }
  if (buffer) processLine(buffer);

  const [exitCode] = (await once(child, "close")) as [number];
  if (exitCode !== 0) {
    throw new Error(`bzip2 failed for ${filePath}: ${stderr.trim() || `exit code ${exitCode}`}`);
  }

  return rows;
}

async function fetchCurrentOrders(client: Client) {
  const result = await client.query("select * from public.orders");
  return result.rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key,
        value instanceof Date ? value.toISOString() : value,
      ]),
    ) as SqlRow
  );
}

async function withClient<T>(connectionString: string, callback: (client: Client) => Promise<T>) {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    return await callback(client);
  } finally {
    await client.end();
  }
}

function tableCounts(tables: SqlTableRows) {
  return Object.fromEntries(Object.entries(tables).map(([table, rows]) => [table, rows.length]));
}

function printSummary(input: {
  oldTables: SqlTableRows;
  newTables: SqlTableRows;
  currentOrders: SqlRow[];
  data: CustomerHistoryImportData;
  mode: "dry-run" | "apply";
  currentSkipped: boolean;
}) {
  console.log(`Customer history import ${input.mode}`);
  console.log("Archive row counts:");
  console.log(JSON.stringify({ old: tableCounts(input.oldTables), new: tableCounts(input.newTables) }, null, 2));
  console.log(`Current Supabase orders: ${input.currentSkipped ? "skipped" : input.currentOrders.length}`);
  console.log("Transformed records:");
  console.log(JSON.stringify(input.data.counts, null, 2));
  if (input.data.errors.length > 0) {
    console.log("Transform errors:");
    console.log(JSON.stringify(input.data.errors.slice(0, 20), null, 2));
  }
}

async function applyImport(
  client: Client,
  data: CustomerHistoryImportData,
  options: CliOptions,
) {
  const importRunId = await createImportRun(client, options);
  try {
    await client.query("begin");

    const customerIds = await upsertCustomers(client, data.customers);
    await upsertIdentities(client, data.identities, customerIds);
    const orderIds = await upsertOrders(client, data.orders, customerIds);
    await upsertItems(client, data.items, orderIds);
    await upsertEvents(client, data.events, customerIds);
    await insertImportErrors(client, importRunId, data.errors);
    await finishImportRun(client, importRunId, "completed", data.counts);

    await client.query("commit");
    console.log(`Applied customer history import run ${importRunId}`);
  } catch (error) {
    await client.query("rollback");
    await finishImportRun(client, importRunId, "failed", {
      ...data.counts,
      failure: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

async function createImportRun(client: Client, options: CliOptions) {
  const result = await client.query<{ id: string }>(
    `insert into public.customer_import_runs (mode, old_archive_path, new_archive_path, status)
     values ($1, $2, $3, 'running')
     returning id`,
    [options.apply ? "apply" : "dry-run", options.oldArchivePath, options.newArchivePath],
  );
  const id = result.rows[0]?.id;
  if (!id) throw new Error("Unable to create import run.");
  return id;
}

async function finishImportRun(
  client: Client,
  importRunId: string,
  status: "completed" | "failed",
  totals: Record<string, unknown>,
) {
  await client.query(
    `update public.customer_import_runs
     set status = $2, finished_at = now(), totals = $3::jsonb
     where id = $1`,
    [importRunId, status, JSON.stringify(totals)],
  );
}

async function upsertCustomers(client: Client, customers: CustomerImportRecord[]) {
  const rows = customers.map((customer) => ({ ...customer }));
  const result = await upsertRows<{ canonical_key: string; id: string }>(
    client,
    "customers",
    [
      "canonical_key",
      "display_name",
      "first_name",
      "last_name",
      "company",
      "primary_email",
      "normalized_email",
      "primary_phone",
      "normalized_phone",
      "address_line1",
      "address_line2",
      "suburb",
      "state",
      "postcode",
      "country",
      "first_seen_at",
      "last_seen_at",
      "order_count",
      "enquiry_count",
      "lifetime_value",
      "source_systems",
      "match_confidence",
      "updated_at",
    ],
    rows.map((row) => ({ ...row, updated_at: new Date().toISOString() })),
    ["canonical_key"],
    "canonical_key,id",
  );
  return new Map(result.map((row) => [row.canonical_key, row.id]));
}

async function upsertIdentities(
  client: Client,
  identities: CustomerIdentityImportRecord[],
  customerIds: Map<string, string>,
) {
  await upsertRows(
    client,
    "customer_identities",
    ["customer_id", "identity_type", "identity_value", "label", "source_system", "source_id", "confidence"],
    identities
      .map((identity) => ({
        customer_id: customerIds.get(identity.customer_key),
        identity_type: identity.identity_type,
        identity_value: identity.identity_value,
        label: identity.label,
        source_system: identity.source_system,
        source_id: identity.source_id,
        confidence: identity.confidence,
      }))
      .filter((row) => Boolean(row.customer_id)),
    ["identity_type", "identity_value"],
  );
}

async function upsertOrders(
  client: Client,
  orders: CustomerOrderHistoryImportRecord[],
  customerIds: Map<string, string>,
) {
  const result = await upsertRows<{ source_system: string; source_id: string; id: string }>(
    client,
    "customer_order_history",
    [
      "customer_id",
      "source_system",
      "source_id",
      "source_order_number",
      "display_order_number",
      "order_status",
      "order_type",
      "customer_name",
      "customer_email",
      "phone",
      "company",
      "address_line1",
      "address_line2",
      "suburb",
      "state",
      "postcode",
      "country",
      "created_at_source",
      "due_date",
      "completed_at",
      "paid_at",
      "total_price",
      "payment_total",
      "refunded_total",
      "payment_summary",
      "payment_reference",
      "payment_provider",
      "card_brand",
      "card_last4",
      "currency",
      "pickup",
      "notes",
      "internal_notes",
      "raw_sanitized",
      "updated_at",
    ],
    orders
      .map((order) => ({
        ...order,
        customer_id: customerIds.get(order.customer_key),
        raw_sanitized: JSON.stringify(order.raw_sanitized),
        updated_at: new Date().toISOString(),
      }))
      .filter((row) => Boolean(row.customer_id)),
    ["source_system", "source_id"],
    "source_system,source_id,id",
  );
  return new Map(result.map((row) => [`${row.source_system}:${row.source_id}`, row.id]));
}

async function upsertItems(
  client: Client,
  items: CustomerOrderItemImportRecord[],
  orderIds: Map<string, string>,
) {
  await upsertRows(
    client,
    "customer_order_items",
    [
      "order_history_id",
      "source_system",
      "source_id",
      "source_order_id",
      "title",
      "design_type",
      "design_text",
      "flavor",
      "quantity",
      "total_weight_kg",
      "unit_price",
      "total_price",
      "made",
      "colors",
      "packaging_summary",
      "asset_refs",
      "raw_sanitized",
      "updated_at",
    ],
    items
      .map((item) => ({
        ...item,
        order_history_id: orderIds.get(`${item.order_source_system}:${item.order_source_id}`),
        colors: JSON.stringify(item.colors),
        asset_refs: JSON.stringify(item.asset_refs),
        raw_sanitized: JSON.stringify(item.raw_sanitized),
        updated_at: new Date().toISOString(),
      }))
      .filter((row) => Boolean(row.order_history_id)),
    ["source_system", "source_id"],
  );
}

async function upsertEvents(
  client: Client,
  events: CustomerContactEventImportRecord[],
  customerIds: Map<string, string>,
) {
  await upsertRows(
    client,
    "customer_contact_events",
    [
      "customer_id",
      "source_system",
      "source_id",
      "event_type",
      "name",
      "email",
      "phone",
      "company",
      "subject",
      "message",
      "occurred_at",
      "subscribed",
      "attachment_path",
      "source_category",
      "raw_sanitized",
      "updated_at",
    ],
    events
      .map((event) => ({
        ...event,
        customer_id: customerIds.get(event.customer_key),
        raw_sanitized: JSON.stringify(event.raw_sanitized),
        updated_at: new Date().toISOString(),
      }))
      .filter((row) => Boolean(row.customer_id)),
    ["source_system", "source_id"],
  );
}

async function insertImportErrors(
  client: Client,
  importRunId: string,
  errors: CustomerHistoryImportData["errors"],
) {
  if (errors.length === 0) return;
  await upsertRows(
    client,
    "customer_import_errors",
    ["import_run_id", "source_system", "source_table", "source_id", "message", "raw_sanitized"],
    errors.map((error) => ({
      import_run_id: importRunId,
      source_system: error.sourceSystem,
      source_table: error.sourceTable,
      source_id: error.sourceId,
      message: error.message,
      raw_sanitized: JSON.stringify(error.rawSanitized),
    })),
    [],
  );
}

async function upsertRows<T extends Record<string, unknown> = Record<string, unknown>>(
  client: Client,
  table: string,
  columns: string[],
  rows: InsertableRecord[],
  conflictColumns: string[],
  returning = "",
) {
  if (rows.length === 0) return [] as T[];
  const returnedRows: T[] = [];
  for (let index = 0; index < rows.length; index += BATCH_SIZE) {
    const batch = rows.slice(index, index + BATCH_SIZE);
    const values: unknown[] = [];
    const valueSql = batch
      .map((row) => {
        const placeholders = columns.map((column) => {
          values.push(row[column] ?? null);
          return `$${values.length}`;
        });
        return `(${placeholders.join(", ")})`;
      })
      .join(", ");
    const updateColumns = columns.filter((column) => !conflictColumns.includes(column));
    const conflictSql =
      conflictColumns.length > 0
        ? `on conflict (${conflictColumns.map((column) => `"${column}"`).join(", ")}) do update set ${updateColumns
            .map((column) => `"${column}" = excluded."${column}"`)
            .join(", ")}`
        : "";
    const sql = `insert into public.${table} (${columns.map((column) => `"${column}"`).join(", ")})
      values ${valueSql}
      ${conflictSql}
      ${returning ? `returning ${returning}` : ""}`;
    const result = await client.query<T>(sql, values);
    returnedRows.push(...result.rows);
  }
  return returnedRows;
}

async function main() {
  await loadLocalEnv();
  const options = parseArgs();
  const connectionString = getConnectionString();
  const mode = options.apply ? "apply" : "dry-run";

  console.log("Parsing old archive...");
  const oldTables = await parseArchive(options.oldArchivePath, getLegacyOldTargetTables());
  console.log("Parsing new archive...");
  const newTables = await parseArchive(options.newArchivePath, getLegacyNewTargetTables());

  let currentOrders: SqlRow[] = [];
  let currentSkipped = !options.includeCurrent;
  if (options.includeCurrent && connectionString) {
    currentOrders = await withClient(connectionString, fetchCurrentOrders);
  } else if (options.includeCurrent) {
    currentSkipped = true;
  }

  const data = buildCustomerHistoryImport({
    legacyOld: oldTables,
    legacyNew: newTables,
    currentOrders,
  });
  printSummary({ oldTables, newTables, currentOrders, data, mode, currentSkipped });

  if (!options.apply) return;
  if (!connectionString) {
    throw new Error("A Postgres connection string is required for --apply.");
  }

  await withClient(connectionString, (client) => applyImport(client, data, options));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
