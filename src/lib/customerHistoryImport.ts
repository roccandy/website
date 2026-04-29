export type SqlScalar = string | number | boolean | null;
export type SqlRow = Record<string, SqlScalar>;
export type SqlTableRows = Record<string, SqlRow[]>;

export type ImportSourceSystem = "legacy_old" | "legacy_new" | "current_next";
export type MatchConfidence = "high" | "medium" | "low";

export type CustomerProfileInput = {
  sourceSystem: ImportSourceSystem;
  sourceId: string;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  suburb?: string | null;
  state?: string | null;
  postcode?: string | null;
  country?: string | null;
  seenAt?: string | null;
};

export type CustomerImportRecord = {
  canonical_key: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  primary_email: string | null;
  normalized_email: string | null;
  primary_phone: string | null;
  normalized_phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  country: string | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  order_count: number;
  enquiry_count: number;
  lifetime_value: number;
  source_systems: ImportSourceSystem[];
  match_confidence: MatchConfidence;
};

export type CustomerIdentityImportRecord = {
  customer_key: string;
  identity_type: "email" | "phone" | "name_address" | "source";
  identity_value: string;
  label: string | null;
  source_system: ImportSourceSystem;
  source_id: string | null;
  confidence: MatchConfidence;
};

export type CustomerOrderHistoryImportRecord = {
  customer_key: string;
  source_system: ImportSourceSystem;
  source_id: string;
  source_order_number: string | null;
  display_order_number: string;
  order_status: string | null;
  order_type: string | null;
  customer_name: string | null;
  customer_email: string | null;
  phone: string | null;
  company: string | null;
  address_line1: string | null;
  address_line2: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  country: string | null;
  created_at_source: string | null;
  due_date: string | null;
  completed_at: string | null;
  paid_at: string | null;
  total_price: number | null;
  payment_total: number | null;
  refunded_total: number | null;
  payment_summary: string | null;
  payment_reference: string | null;
  payment_provider: string | null;
  card_brand: string | null;
  card_last4: string | null;
  currency: "AUD";
  pickup: boolean | null;
  notes: string | null;
  internal_notes: string | null;
  raw_sanitized: Record<string, unknown>;
};

export type CustomerOrderItemImportRecord = {
  order_source_system: ImportSourceSystem;
  order_source_id: string;
  source_system: ImportSourceSystem;
  source_id: string;
  source_order_id: string | null;
  title: string | null;
  design_type: string | null;
  design_text: string | null;
  flavor: string | null;
  quantity: number | null;
  total_weight_kg: number | null;
  unit_price: number | null;
  total_price: number | null;
  made: boolean | null;
  colors: Record<string, unknown>;
  packaging_summary: string | null;
  asset_refs: Record<string, unknown>;
  raw_sanitized: Record<string, unknown>;
};

export type CustomerContactEventImportRecord = {
  customer_key: string;
  source_system: ImportSourceSystem;
  source_id: string;
  event_type: "enquiry";
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  subject: string | null;
  message: string | null;
  occurred_at: string | null;
  subscribed: boolean | null;
  attachment_path: string | null;
  source_category: string | null;
  raw_sanitized: Record<string, unknown>;
};

export type CustomerHistoryImportData = {
  customers: CustomerImportRecord[];
  identities: CustomerIdentityImportRecord[];
  orders: CustomerOrderHistoryImportRecord[];
  items: CustomerOrderItemImportRecord[];
  events: CustomerContactEventImportRecord[];
  errors: ImportTransformError[];
  counts: Record<string, number>;
};

export type ImportTransformError = {
  sourceSystem: ImportSourceSystem;
  sourceTable: string;
  sourceId: string | null;
  message: string;
  rawSanitized: Record<string, unknown>;
};

type InsertStatement = {
  table: string;
  columns: string[];
  rows: SqlScalar[][];
};

type CustomerDraft = CustomerImportRecord & {
  identities: Map<string, CustomerIdentityImportRecord>;
};

const CONFIDENCE_RANK: Record<MatchConfidence, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const LEGACY_OLD_TABLES = new Set([
  "orders",
  "shopping_cart_items",
  "payments",
  "contact_messages",
  "flavours",
  "sales_types",
  "payment_methods",
  "delivery_types",
  "delivery_options",
]);

const LEGACY_NEW_TABLES = new Set([
  "orders",
  "orderItems",
  "contactMessages",
  "orderTypes",
  "orderStatuses",
  "paymentMethods",
]);

export function getLegacyOldTargetTables() {
  return new Set(LEGACY_OLD_TABLES);
}

export function getLegacyNewTargetTables() {
  return new Set(LEGACY_NEW_TABLES);
}

export function normalizeText(value: SqlScalar | string | undefined) {
  if (value === null || value === undefined) return null;
  const text = String(value).replace(/\u0000/g, "").replace(/\s+/g, " ").trim();
  return text.length > 0 ? text : null;
}

export function normalizeEmail(value: SqlScalar | string | undefined) {
  const text = normalizeText(value);
  return text ? text.toLowerCase() : null;
}

export function normalizePhone(value: SqlScalar | string | undefined) {
  const text = normalizeText(value);
  if (!text) return null;
  const normalized = text.replace(/[^\d+]/g, "");
  return normalized.length >= 6 ? normalized : null;
}

function normalizeKeyText(value: SqlScalar | string | undefined) {
  return normalizeText(value)?.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ") ?? null;
}

function toNumber(value: SqlScalar | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const numberValue = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  return Number.isFinite(numberValue) ? numberValue : null;
}

function toBoolean(value: SqlScalar | undefined) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const normalized = value.toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return null;
}

function toIsoDateTime(value: SqlScalar | undefined) {
  const text = normalizeText(value);
  if (!text || text === "0000-00-00" || text.startsWith("0000-00-00")) return null;
  const parsed = new Date(text.includes("T") ? text : text.includes(" ") ? `${text.replace(" ", "T")}Z` : `${text}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function toIsoDate(value: SqlScalar | undefined) {
  const text = normalizeText(value);
  if (!text || text === "0000-00-00") return null;
  const match = text.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
}

function joinText(parts: Array<SqlScalar | string | null | undefined>, separator = " ") {
  const values = parts.map((part) => normalizeText(part ?? null)).filter((part): part is string => Boolean(part));
  return values.length > 0 ? values.join(separator) : null;
}

function bestConfidence(a: MatchConfidence, b: MatchConfidence): MatchConfidence {
  return CONFIDENCE_RANK[a] >= CONFIDENCE_RANK[b] ? a : b;
}

function earliestIso(a: string | null, b: string | null) {
  if (!a) return b;
  if (!b) return a;
  return a <= b ? a : b;
}

function latestIso(a: string | null, b: string | null) {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
}

function money(value: number | null) {
  if (value === null || !Number.isFinite(value)) return null;
  return Math.round(value * 100) / 100;
}

function makeSafeObject(input: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== null && value !== undefined && value !== "")
  );
}

function identityKeysForProfile(profile: CustomerProfileInput) {
  const keys: CustomerIdentityImportRecord[] = [];
  const email = normalizeEmail(profile.email);
  const phone = normalizePhone(profile.phone);
  const name = normalizeKeyText(profile.name ?? joinText([profile.firstName, profile.lastName]));
  const address = normalizeKeyText(profile.addressLine1);
  const postcode = normalizeKeyText(profile.postcode);

  if (email) {
    keys.push({
      customer_key: "",
      identity_type: "email",
      identity_value: email,
      label: normalizeText(profile.email),
      source_system: profile.sourceSystem,
      source_id: profile.sourceId,
      confidence: "high",
    });
  }
  if (phone) {
    keys.push({
      customer_key: "",
      identity_type: "phone",
      identity_value: phone,
      label: normalizeText(profile.phone),
      source_system: profile.sourceSystem,
      source_id: profile.sourceId,
      confidence: "high",
    });
  }
  if (name && (postcode || address)) {
    keys.push({
      customer_key: "",
      identity_type: "name_address",
      identity_value: [name, postcode, address].filter(Boolean).join("|"),
      label: joinText([profile.name ?? joinText([profile.firstName, profile.lastName]), profile.postcode, profile.addressLine1], " | "),
      source_system: profile.sourceSystem,
      source_id: profile.sourceId,
      confidence: "medium",
    });
  }

  keys.push({
    customer_key: "",
    identity_type: "source",
    identity_value: `${profile.sourceSystem}:${profile.sourceId}`,
    label: `${profile.sourceSystem}:${profile.sourceId}`,
    source_system: profile.sourceSystem,
    source_id: profile.sourceId,
    confidence: "low",
  });

  return keys;
}

function canonicalKeyForProfile(profile: CustomerProfileInput) {
  const email = normalizeEmail(profile.email);
  if (email) return { key: `email:${email}`, confidence: "high" as const };
  const phone = normalizePhone(profile.phone);
  if (phone) return { key: `phone:${phone}`, confidence: "high" as const };
  const name = normalizeKeyText(profile.name ?? joinText([profile.firstName, profile.lastName]));
  const address = normalizeKeyText(profile.addressLine1);
  const postcode = normalizeKeyText(profile.postcode);
  if (name && (postcode || address)) {
    return { key: `name_address:${[name, postcode, address].filter(Boolean).join("|")}`, confidence: "medium" as const };
  }
  return { key: `source:${profile.sourceSystem}:${profile.sourceId}`, confidence: "low" as const };
}

class CustomerAccumulator {
  private customers = new Map<string, CustomerDraft>();
  private identityToCustomer = new Map<string, string>();
  private customerAliases = new Map<string, string>();

  resolve(profile: CustomerProfileInput) {
    const identities = identityKeysForProfile(profile);
    const existingKeys = identities
      .map((identity) => {
        const customerKey = this.identityToCustomer.get(`${identity.identity_type}:${identity.identity_value}`);
        return customerKey ? this.canonicalKeyFor(customerKey) : null;
      })
      .filter((value): value is string => Boolean(value));
    const uniqueExistingKeys = Array.from(new Set(existingKeys));
    const canonical = canonicalKeyForProfile(profile);
    const targetKey = uniqueExistingKeys[0] ?? this.canonicalKeyFor(canonical.key);

    if (!this.customers.has(targetKey)) {
      this.customers.set(targetKey, {
        canonical_key: targetKey,
        display_name: normalizeText(profile.name) ?? joinText([profile.firstName, profile.lastName]),
        first_name: normalizeText(profile.firstName),
        last_name: normalizeText(profile.lastName),
        company: normalizeText(profile.company),
        primary_email: normalizeText(profile.email),
        normalized_email: normalizeEmail(profile.email),
        primary_phone: normalizeText(profile.phone),
        normalized_phone: normalizePhone(profile.phone),
        address_line1: normalizeText(profile.addressLine1),
        address_line2: normalizeText(profile.addressLine2),
        suburb: normalizeText(profile.suburb),
        state: normalizeText(profile.state),
        postcode: normalizeText(profile.postcode),
        country: normalizeText(profile.country),
        first_seen_at: toIsoDateTime(profile.seenAt ?? null),
        last_seen_at: toIsoDateTime(profile.seenAt ?? null),
        order_count: 0,
        enquiry_count: 0,
        lifetime_value: 0,
        source_systems: [profile.sourceSystem],
        match_confidence: canonical.confidence,
        identities: new Map(),
      });
    }

    uniqueExistingKeys.slice(1).forEach((sourceKey) => this.mergeCustomers(targetKey, sourceKey));
    const customer = this.customers.get(targetKey);
    if (!customer) throw new Error("Unable to resolve customer.");

    customer.display_name = customer.display_name ?? normalizeText(profile.name) ?? joinText([profile.firstName, profile.lastName]);
    customer.first_name = customer.first_name ?? normalizeText(profile.firstName);
    customer.last_name = customer.last_name ?? normalizeText(profile.lastName);
    customer.company = customer.company ?? normalizeText(profile.company);
    customer.primary_email = customer.primary_email ?? normalizeText(profile.email);
    customer.normalized_email = customer.normalized_email ?? normalizeEmail(profile.email);
    customer.primary_phone = customer.primary_phone ?? normalizeText(profile.phone);
    customer.normalized_phone = customer.normalized_phone ?? normalizePhone(profile.phone);
    customer.address_line1 = customer.address_line1 ?? normalizeText(profile.addressLine1);
    customer.address_line2 = customer.address_line2 ?? normalizeText(profile.addressLine2);
    customer.suburb = customer.suburb ?? normalizeText(profile.suburb);
    customer.state = customer.state ?? normalizeText(profile.state);
    customer.postcode = customer.postcode ?? normalizeText(profile.postcode);
    customer.country = customer.country ?? normalizeText(profile.country);
    customer.first_seen_at = earliestIso(customer.first_seen_at, toIsoDateTime(profile.seenAt ?? null));
    customer.last_seen_at = latestIso(customer.last_seen_at, toIsoDateTime(profile.seenAt ?? null));
    customer.match_confidence = bestConfidence(customer.match_confidence, canonical.confidence);
    if (!customer.source_systems.includes(profile.sourceSystem)) {
      customer.source_systems.push(profile.sourceSystem);
    }

    identities.forEach((identity) => {
      const identityKey = `${identity.identity_type}:${identity.identity_value}`;
      const nextIdentity = { ...identity, customer_key: targetKey };
      customer.identities.set(identityKey, nextIdentity);
      this.identityToCustomer.set(identityKey, targetKey);
    });

    return targetKey;
  }

  addOrder(customerKey: string, order: Pick<CustomerOrderHistoryImportRecord, "created_at_source" | "total_price">) {
    const customer = this.customers.get(customerKey);
    if (!customer) return;
    customer.order_count += 1;
    customer.lifetime_value = money(customer.lifetime_value + Number(order.total_price ?? 0)) ?? customer.lifetime_value;
    customer.first_seen_at = earliestIso(customer.first_seen_at, order.created_at_source);
    customer.last_seen_at = latestIso(customer.last_seen_at, order.created_at_source);
  }

  addEvent(customerKey: string, event: Pick<CustomerContactEventImportRecord, "occurred_at">) {
    const customer = this.customers.get(customerKey);
    if (!customer) return;
    customer.enquiry_count += 1;
    customer.first_seen_at = earliestIso(customer.first_seen_at, event.occurred_at);
    customer.last_seen_at = latestIso(customer.last_seen_at, event.occurred_at);
  }

  toRecords() {
    const customers = Array.from(this.customers.values()).map((draft) => {
      const { identities, ...customer } = draft;
      void identities;
      return {
        ...customer,
        source_systems: [...customer.source_systems].sort(),
      };
    });
    const identities = Array.from(this.customers.values()).flatMap((customer) => Array.from(customer.identities.values()));
    return { customers, identities };
  }

  canonicalKeyFor(key: string) {
    let current = key;
    const seen = new Set<string>();
    while (this.customerAliases.has(current) && !seen.has(current)) {
      seen.add(current);
      current = this.customerAliases.get(current) ?? current;
    }
    return current;
  }

  private mergeCustomers(targetKey: string, sourceKey: string) {
    targetKey = this.canonicalKeyFor(targetKey);
    sourceKey = this.canonicalKeyFor(sourceKey);
    if (targetKey === sourceKey) return;
    const target = this.customers.get(targetKey);
    const source = this.customers.get(sourceKey);
    if (!target || !source) return;

    target.display_name = target.display_name ?? source.display_name;
    target.first_name = target.first_name ?? source.first_name;
    target.last_name = target.last_name ?? source.last_name;
    target.company = target.company ?? source.company;
    target.primary_email = target.primary_email ?? source.primary_email;
    target.normalized_email = target.normalized_email ?? source.normalized_email;
    target.primary_phone = target.primary_phone ?? source.primary_phone;
    target.normalized_phone = target.normalized_phone ?? source.normalized_phone;
    target.address_line1 = target.address_line1 ?? source.address_line1;
    target.address_line2 = target.address_line2 ?? source.address_line2;
    target.suburb = target.suburb ?? source.suburb;
    target.state = target.state ?? source.state;
    target.postcode = target.postcode ?? source.postcode;
    target.country = target.country ?? source.country;
    target.first_seen_at = earliestIso(target.first_seen_at, source.first_seen_at);
    target.last_seen_at = latestIso(target.last_seen_at, source.last_seen_at);
    target.order_count += source.order_count;
    target.enquiry_count += source.enquiry_count;
    target.lifetime_value = money(target.lifetime_value + source.lifetime_value) ?? target.lifetime_value;
    target.match_confidence = bestConfidence(target.match_confidence, source.match_confidence);
    source.source_systems.forEach((sourceSystem) => {
      if (!target.source_systems.includes(sourceSystem)) target.source_systems.push(sourceSystem);
    });
    source.identities.forEach((identity, identityKey) => {
      const moved = { ...identity, customer_key: targetKey };
      target.identities.set(identityKey, moved);
      this.identityToCustomer.set(identityKey, targetKey);
    });
    this.customers.delete(sourceKey);
    this.customerAliases.set(sourceKey, targetKey);
  }
}

export function parseInsertStatement(sql: string): InsertStatement | null {
  const headerMatch = sql.match(/INSERT\s+INTO\s+`([^`]+)`\s*\(([\s\S]*?)\)\s*VALUES/i);
  if (!headerMatch) return null;
  const [, table, columnSql] = headerMatch;
  const columns = Array.from(columnSql.matchAll(/`([^`]+)`/g)).map((match) => match[1]);
  const valuesIndex = headerMatch.index! + headerMatch[0].length;
  const rows = parseValues(sql.slice(valuesIndex));
  return { table, columns, rows };
}

export function rowsFromInsertStatement(sql: string) {
  const parsed = parseInsertStatement(sql);
  if (!parsed) return { table: null, rows: [] as SqlRow[] };
  return {
    table: parsed.table,
    rows: parsed.rows.map((values) =>
      Object.fromEntries(parsed.columns.map((column, index) => [column, values[index] ?? null]))
    ),
  };
}

function parseValues(sql: string) {
  const rows: SqlScalar[][] = [];
  let index = 0;
  while (index < sql.length) {
    index = skipWhitespaceAndCommas(sql, index);
    if (sql[index] === ";") break;
    if (sql[index] !== "(") {
      index += 1;
      continue;
    }
    index += 1;
    const row: SqlScalar[] = [];
    while (index < sql.length) {
      index = skipWhitespace(sql, index);
      const parsed = parseValue(sql, index);
      row.push(parsed.value);
      index = skipWhitespace(sql, parsed.nextIndex);
      if (sql[index] === ",") {
        index += 1;
        continue;
      }
      if (sql[index] === ")") {
        index += 1;
        rows.push(row);
        break;
      }
      throw new Error(`Unexpected SQL value terminator at index ${index}`);
    }
  }
  return rows;
}

function skipWhitespace(sql: string, index: number) {
  let next = index;
  while (/\s/.test(sql[next] ?? "")) next += 1;
  return next;
}

function skipWhitespaceAndCommas(sql: string, index: number) {
  let next = index;
  while (/[\s,]/.test(sql[next] ?? "")) next += 1;
  return next;
}

function parseValue(sql: string, index: number): { value: SqlScalar; nextIndex: number } {
  const char = sql[index];
  if (char === "'") return parseQuotedString(sql, index);
  if ((char === "X" || char === "x") && sql[index + 1] === "'") return parseHexString(sql, index + 1);

  let end = index;
  while (end < sql.length && sql[end] !== "," && sql[end] !== ")") end += 1;
  const raw = sql.slice(index, end).trim();
  if (!raw || raw.toUpperCase() === "NULL") return { value: null, nextIndex: end };
  if (/^-?\d+(\.\d+)?$/.test(raw)) return { value: Number(raw), nextIndex: end };
  return { value: raw, nextIndex: end };
}

function parseQuotedString(sql: string, index: number): { value: string; nextIndex: number } {
  let next = index + 1;
  let value = "";
  while (next < sql.length) {
    const char = sql[next];
    if (char === "'") {
      if (sql[next + 1] === "'") {
        value += "'";
        next += 2;
        continue;
      }
      return { value, nextIndex: next + 1 };
    }
    if (char === "\\") {
      const escaped = sql[next + 1];
      value += decodeMysqlEscape(escaped);
      next += 2;
      continue;
    }
    value += char;
    next += 1;
  }
  throw new Error("Unterminated SQL string literal.");
}

function parseHexString(sql: string, quoteIndex: number): { value: string; nextIndex: number } {
  const parsed = parseQuotedString(sql, quoteIndex);
  try {
    return { value: Buffer.from(parsed.value, "hex").toString("utf8"), nextIndex: parsed.nextIndex };
  } catch {
    return parsed;
  }
}

function decodeMysqlEscape(value: string | undefined) {
  switch (value) {
    case "0":
      return "\0";
    case "b":
      return "\b";
    case "n":
      return "\n";
    case "r":
      return "\r";
    case "t":
      return "\t";
    case "Z":
      return "\u001a";
    case undefined:
      return "";
    default:
      return value;
  }
}

export function addRowsFromInsertSql(tables: SqlTableRows, statementSql: string) {
  const parsed = rowsFromInsertStatement(statementSql);
  if (!parsed.table) return;
  const existing = tables[parsed.table] ?? [];
  existing.push(...parsed.rows);
  tables[parsed.table] = existing;
}

export function buildCustomerHistoryImport(input: {
  legacyOld?: SqlTableRows;
  legacyNew?: SqlTableRows;
  currentOrders?: SqlRow[];
}): CustomerHistoryImportData {
  const accumulator = new CustomerAccumulator();
  const orders: CustomerOrderHistoryImportRecord[] = [];
  const items: CustomerOrderItemImportRecord[] = [];
  const events: CustomerContactEventImportRecord[] = [];
  const errors: ImportTransformError[] = [];

  if (input.legacyOld) {
    appendLegacyOld(input.legacyOld, accumulator, orders, items, events, errors);
  }
  if (input.legacyNew) {
    appendLegacyNew(input.legacyNew, accumulator, orders, items, events, errors);
  }
  if (input.currentOrders) {
    appendCurrentOrders(input.currentOrders, accumulator, orders, items, errors);
  }

  orders.forEach((order) => {
    order.customer_key = accumulator.canonicalKeyFor(order.customer_key);
  });
  events.forEach((event) => {
    event.customer_key = accumulator.canonicalKeyFor(event.customer_key);
  });

  const { customers, identities } = accumulator.toRecords();
  return {
    customers,
    identities,
    orders,
    items,
    events,
    errors,
    counts: {
      customers: customers.length,
      identities: identities.length,
      orders: orders.length,
      items: items.length,
      events: events.length,
      errors: errors.length,
    },
  };
}

function appendLegacyOld(
  tables: SqlTableRows,
  accumulator: CustomerAccumulator,
  orders: CustomerOrderHistoryImportRecord[],
  items: CustomerOrderItemImportRecord[],
  events: CustomerContactEventImportRecord[],
  errors: ImportTransformError[],
) {
  const flavors = lookup(tables.flavours, "flavour_id", "flavour");
  const salesTypes = lookup(tables.sales_types, "sales_type_id", "short", "name");
  const paymentMethods = lookup(tables.payment_methods, "payment_method_id", "payment_method_name");
  const paymentsByOrderId = groupRows(tables.payments, "order_id");
  const legacyOrderIds = new Set((tables.orders ?? []).map((row) => String(row.order_id ?? "")));
  const orphanCartSummaries = summarizeOrphanOldCartItems(tables.shopping_cart_items ?? [], legacyOrderIds);

  for (const row of tables.orders ?? []) {
    const sourceId = String(row.order_id ?? "");
    if (!sourceId) continue;
    try {
      const name = joinText([row.firstname, row.surname]) ?? normalizeText(row.shipping_name);
      const phone = normalizeText(row.telephone) ?? normalizeText(row.mobile);
      const createdAt = toIsoDateTime(row.order_date);
      const customerKey = accumulator.resolve({
        sourceSystem: "legacy_old",
        sourceId: `orders:${sourceId}`,
        name,
        firstName: normalizeText(row.firstname),
        lastName: normalizeText(row.surname),
        email: normalizeText(row.email),
        phone,
        addressLine1: normalizeText(row.address),
        addressLine2: normalizeText(row.address2),
        suburb: normalizeText(row.suburb),
        state: normalizeText(row.state),
        postcode: normalizeText(row.postcode),
        country: normalizeText(row.country),
        seenAt: createdAt,
      });
      const paymentRows = paymentsByOrderId.get(sourceId) ?? [];
      const paymentSummary = summarizeOldPayments(paymentRows, paymentMethods);
      const history: CustomerOrderHistoryImportRecord = {
        customer_key: customerKey,
        source_system: "legacy_old",
        source_id: sourceId,
        source_order_number: sourceId,
        display_order_number: `old #${sourceId}`,
        order_status: toBoolean(row.cancelled) ? "cancelled" : toBoolean(row.success) || row.actual_dispatch ? "completed" : "unknown",
        order_type: null,
        customer_name: name,
        customer_email: normalizeText(row.email),
        phone,
        company: null,
        address_line1: normalizeText(row.address),
        address_line2: normalizeText(row.address2),
        suburb: normalizeText(row.suburb),
        state: normalizeText(row.state),
        postcode: normalizeText(row.postcode),
        country: normalizeText(row.country),
        created_at_source: createdAt,
        due_date: toIsoDate(row.date_required),
        completed_at: toIsoDateTime(row.actual_dispatch),
        paid_at: paymentSummary.latestPaymentAt,
        total_price: money(toNumber(row.total)),
        payment_total: money(paymentSummary.paidTotal),
        refunded_total: money(paymentSummary.refundedTotal),
        payment_summary: paymentSummary.summary,
        payment_reference: paymentSummary.references,
        payment_provider: paymentMethods.get(String(row.payment_method_id ?? "")) ?? null,
        card_brand: null,
        card_last4: null,
        currency: "AUD",
        pickup: Number(row.delivery_type_id ?? 0) === 2,
        notes: normalizeText(row.comments) ?? normalizeText(row.note),
        internal_notes: null,
        raw_sanitized: makeSafeObject({
          order_id: row.order_id,
          order_date: row.order_date,
          payment_method_id: row.payment_method_id,
          product_cost: row.product_cost,
          paid: row.paid,
          gst: row.gst,
          shipping_fee: row.shipping_fee,
          urgent_fee: row.urgent_fee,
          pinstriping_fee: row.pinstriping_fee,
          delivery_type_id: row.delivery_type_id,
          delivery_option_id: row.delivery_option_id,
          advertising_source_id: row.advertising_source_id,
          courier_reference: row.courier_reference,
          subscribe: row.subscribe,
          order_confirmation: row.order_confirmation,
          success: row.success,
          cancelled: row.cancelled,
        }),
      };
      orders.push(history);
      accumulator.addOrder(customerKey, history);
    } catch (error) {
      errors.push(transformError("legacy_old", "orders", sourceId, error, { order_id: row.order_id }));
    }
  }

  orphanCartSummaries.forEach((summary, orderId) => {
    const createdAt = summary.createdAt;
    const customerKey = accumulator.resolve({
      sourceSystem: "legacy_old",
      sourceId: "orphan_cart_items",
      name: "Unknown legacy cart customer",
      seenAt: createdAt,
    });
    orders.push({
      customer_key: customerKey,
      source_system: "legacy_old",
      source_id: oldOrphanCartOrderSourceId(orderId),
      source_order_number: orderId,
      display_order_number: `old orphan cart #${orderId}`,
      order_status: "orphaned cart item",
      order_type: "cart-only",
      customer_name: "Unknown legacy cart customer",
      customer_email: null,
      phone: null,
      company: null,
      address_line1: null,
      address_line2: null,
      suburb: null,
      state: null,
      postcode: null,
      country: null,
      created_at_source: createdAt,
      due_date: null,
      completed_at: null,
      paid_at: null,
      total_price: money(summary.total),
      payment_total: null,
      refunded_total: null,
      payment_summary: null,
      payment_reference: null,
      payment_provider: null,
      card_brand: null,
      card_last4: null,
      currency: "AUD",
      pickup: null,
      notes: `Legacy cart item data references order ${orderId}, but that order is not present in the old orders dump.`,
      internal_notes: null,
      raw_sanitized: makeSafeObject({
        orphan_cart_order_id: orderId,
        orphan_cart_item_count: summary.itemCount,
        source_reason: "shopping_cart_items row had no matching orders row",
      }),
    });
  });

  for (const row of tables.shopping_cart_items ?? []) {
    const sourceId = String(row.shopping_cart_item_id ?? "");
    if (!sourceId) continue;
    const sourceOrderId = String(row.order_id ?? "");
    const orderSourceId = legacyOrderIds.has(sourceOrderId) ? sourceOrderId : oldOrphanCartOrderSourceId(sourceOrderId);
    const salesType = salesTypes.get(String(row.sales_type_id ?? "")) ?? null;
    const designText =
      normalizeText(row.feature) ??
      normalizeText(row.text) ??
      joinText([row.upper_text, row.bottom_text]) ??
      joinText([row.left_initial, row.right_initial], " heart ");
    items.push({
      order_source_system: "legacy_old",
      order_source_id: orderSourceId,
      source_system: "legacy_old",
      source_id: sourceId,
      source_order_id: sourceOrderId,
      title: normalizeText(row.title),
      design_type: salesType,
      design_text: designText,
      flavor: flavors.get(String(row.flavour_id ?? "")) ?? null,
      quantity: toNumber(row.quantity),
      total_weight_kg: money((toNumber(row.candy_weight) ?? 0) / 1000),
      unit_price: money(toNumber(row.unit_price)),
      total_price: money(toNumber(row.total)),
      made: toBoolean(row.made),
      colors: makeSafeObject({
        outside: row.outside_colour,
        text: row.text_colour,
        heart: row.heart_colour,
      }),
      packaging_summary: null,
      asset_refs: makeSafeObject({
        candy_preview: row.candy_preview,
        uploaded_file: row.uploaded_file,
      }),
      raw_sanitized: makeSafeObject({
        product_id: row.product_id,
        sales_type_id: row.sales_type_id,
        retail_design_id: row.retail_design_id,
        flavour_id: row.flavour_id,
        pinstriping_option_id: row.pinstriping_option_id,
        urgent_fee: row.urgent_fee,
        pinstriping_fee: row.pinstriping_fee,
        shipping_fee: row.shipping_fee,
        product_cost: row.product_cost,
        date_added: row.date_added,
        diary_date: row.diary_date,
        approved: row.approved,
        orphan_order_reference: legacyOrderIds.has(sourceOrderId) ? null : sourceOrderId,
      }),
    });
  }

  for (const row of tables.contact_messages ?? []) {
    const sourceId = String(row.contact_message_id ?? "");
    if (!sourceId) continue;
    const occurredAt = toIsoDateTime(row.date_received);
    const customerKey = accumulator.resolve({
      sourceSystem: "legacy_old",
      sourceId: `contact_messages:${sourceId}`,
      name: normalizeText(row.name),
      company: normalizeText(row.company),
      email: normalizeText(row.email),
      phone: normalizeText(row.telephone),
      addressLine1: normalizeText(row.postal_address),
      seenAt: occurredAt,
    });
    const event: CustomerContactEventImportRecord = {
      customer_key: customerKey,
      source_system: "legacy_old",
      source_id: sourceId,
      event_type: "enquiry",
      name: normalizeText(row.name),
      email: normalizeText(row.email),
      phone: normalizeText(row.telephone),
      company: normalizeText(row.company),
      subject: normalizeText(row.how_you_heard),
      message: normalizeText(row.content),
      occurred_at: occurredAt,
      subscribed: toBoolean(row.mailing_list),
      attachment_path: null,
      source_category: null,
      raw_sanitized: makeSafeObject({
        contact_message_id: row.contact_message_id,
        postal_address: row.postal_address,
        fax: row.fax,
        how_you_heard: row.how_you_heard,
        mailing_list: row.mailing_list,
      }),
    };
    events.push(event);
    accumulator.addEvent(customerKey, event);
  }
}

function appendLegacyNew(
  tables: SqlTableRows,
  accumulator: CustomerAccumulator,
  orders: CustomerOrderHistoryImportRecord[],
  items: CustomerOrderItemImportRecord[],
  events: CustomerContactEventImportRecord[],
  errors: ImportTransformError[],
) {
  const paymentMethods = lookup(tables.paymentMethods, "id", "paymentMethod");
  const orderTypes = lookup(tables.orderTypes, "id", "title");
  const orderStatuses = lookup(tables.orderStatuses, "id", "title");

  for (const row of tables.orders ?? []) {
    const sourceId = String(row.id ?? "");
    if (!sourceId) continue;
    try {
      const createdAt = toIsoDateTime(row.created_at);
      const customerKey = accumulator.resolve({
        sourceSystem: "legacy_new",
        sourceId: `orders:${sourceId}`,
        name: normalizeText(row.customer),
        company: normalizeText(row.company),
        email: normalizeText(row.email),
        phone: normalizeText(row.telephone),
        addressLine1: normalizeText(row.address1),
        addressLine2: normalizeText(row.address2),
        suburb: normalizeText(row.suburb),
        state: normalizeText(row.state),
        postcode: normalizeText(row.postcode),
        country: "AU",
        seenAt: createdAt,
      });
      const paymentReference =
        extractPaymentReference(normalizeText(row.gatewayResult)) ?? extractPaymentReference(normalizeText(row.gatewayResponse));
      const history: CustomerOrderHistoryImportRecord = {
        customer_key: customerKey,
        source_system: "legacy_new",
        source_id: sourceId,
        source_order_number: sourceId,
        display_order_number: `new #${sourceId}`,
        order_status: orderStatuses.get(String(row.orderStatusId ?? "")) ?? null,
        order_type: orderTypes.get(String(row.orderTypeId ?? "")) ?? null,
        customer_name: normalizeText(row.customer),
        customer_email: normalizeText(row.email),
        phone: normalizeText(row.telephone),
        company: normalizeText(row.company),
        address_line1: normalizeText(row.address1),
        address_line2: normalizeText(row.address2),
        suburb: normalizeText(row.suburb),
        state: normalizeText(row.state),
        postcode: normalizeText(row.postcode),
        country: "AU",
        created_at_source: createdAt,
        due_date: toIsoDate(row.dateRequired),
        completed_at: toIsoDateTime(row.dispatchDate),
        paid_at: toIsoDateTime(row.paymentTimestamp),
        total_price: money(toNumber(row.orderTotal)),
        payment_total: money(toNumber(row.paymentTotal)),
        refunded_total: money(toNumber(row.discount) && Number(row.discount) < 0 ? Math.abs(Number(row.discount)) : 0),
        payment_summary: paymentMethods.get(String(row.paymentMethodId ?? "")) ?? null,
        payment_reference: paymentReference,
        payment_provider: paymentMethods.get(String(row.paymentMethodId ?? "")) ?? null,
        card_brand: normalizeText(row.ccBrand),
        card_last4: normalizeText(row.ccLast4),
        currency: "AUD",
        pickup: toBoolean(row.localPickup),
        notes: normalizeText(row.notes),
        internal_notes: normalizeText(row.internalNotes) ?? normalizeText(row.productionNotes),
        raw_sanitized: makeSafeObject({
          id: row.id,
          uuid: row.uuid,
          orderTypeId: row.orderTypeId,
          orderStatusId: row.orderStatusId,
          regionId: row.regionId,
          countryId: row.countryId,
          productionDate: row.productionDate,
          shippingDeadline: row.shippingDeadline,
          dispatchDate: row.dispatchDate,
          shipping: row.shipping,
          trackingNumber: row.trackingNumber,
          localPickup: row.localPickup,
          extraCharges: row.extraCharges,
          transactionFee: row.transactionFee,
          urgencyFee: row.urgencyFee,
          gst: row.gst,
          discount: row.discount,
          paymentMethodId: row.paymentMethodId,
          hasGatewayResponse: Boolean(row.gatewayResponse),
          hasGatewayResult: Boolean(row.gatewayResult),
        }),
      };
      orders.push(history);
      accumulator.addOrder(customerKey, history);
    } catch (error) {
      errors.push(transformError("legacy_new", "orders", sourceId, error, { id: row.id }));
    }
  }

  for (const row of tables.orderItems ?? []) {
    const sourceId = String(row.id ?? "");
    if (!sourceId) continue;
    items.push({
      order_source_system: "legacy_new",
      order_source_id: String(row.orderId ?? ""),
      source_system: "legacy_new",
      source_id: sourceId,
      source_order_id: String(row.orderId ?? ""),
      title: normalizeText(row.title) ?? normalizeText(row.jobName),
      design_type: normalizeText(row.categoryId) ? `category ${row.categoryId}` : null,
      design_text: joinText([row.textOne, row.textTwo]) ?? normalizeText(row.jobName),
      flavor: normalizeText(row.flavour),
      quantity: toNumber(row.quantity),
      total_weight_kg: money((toNumber(row.totalWeight) ?? 0) / 1000),
      unit_price: money(toNumber(row.unitPrice)),
      total_price: money(toNumber(row.subTotal)),
      made: toBoolean(row.made),
      colors: makeSafeObject({
        text: row.textColour,
        heart: row.heartColour,
        outer_one: row.outerColour1,
        outer_two: row.outerColour2,
        outer_colours: row.outerColours,
        rainbow_jacket: row.rainbowJacket,
        pin_stripe: row.pinStripe,
      }),
      packaging_summary: joinText([row.packageId ? `package ${row.packageId}` : null, row.packageOptionId ? `option ${row.packageOptionId}` : null], ", "),
      asset_refs: makeSafeObject({
        preview: row.preview,
        logo_art: row.logoArt,
        label_art: row.labelArt,
      }),
      raw_sanitized: makeSafeObject({
        uuid: row.uuid,
        orderId: row.orderId,
        categoryId: row.categoryId,
        productId: row.productId,
        packageId: row.packageId,
        packageOptionId: row.packageOptionId,
        label: row.label,
        designNotes: row.designNotes,
      }),
    });
  }

  for (const row of tables.contactMessages ?? []) {
    const sourceId = String(row.id ?? "");
    if (!sourceId) continue;
    const occurredAt = toIsoDateTime(row.created_at);
    const customerKey = accumulator.resolve({
      sourceSystem: "legacy_new",
      sourceId: `contactMessages:${sourceId}`,
      name: normalizeText(row.name),
      company: normalizeText(row.company),
      email: normalizeText(row.email),
      phone: normalizeText(row.telephone),
      country: normalizeText(row.country),
      suburb: normalizeText(row.city),
      seenAt: occurredAt,
    });
    const event: CustomerContactEventImportRecord = {
      customer_key: customerKey,
      source_system: "legacy_new",
      source_id: sourceId,
      event_type: "enquiry",
      name: normalizeText(row.name),
      email: normalizeText(row.email),
      phone: normalizeText(row.telephone),
      company: normalizeText(row.company),
      subject: normalizeText(row.howHeard),
      message: normalizeText(row.message),
      occurred_at: occurredAt,
      subscribed: toBoolean(row.subscribed),
      attachment_path: normalizeText(row.attachment),
      source_category: normalizeText(row.categoryId),
      raw_sanitized: makeSafeObject({
        id: row.id,
        categoryId: row.categoryId,
        country: row.country,
        city: row.city,
        howHeard: row.howHeard,
        note: row.note,
        attachment: row.attachment,
        subscribed: row.subscribed,
        viewed: row.viewed,
        viewedTimestamp: row.viewedTimestamp,
      }),
    };
    events.push(event);
    accumulator.addEvent(customerKey, event);
  }
}

function appendCurrentOrders(
  currentOrders: SqlRow[],
  accumulator: CustomerAccumulator,
  orders: CustomerOrderHistoryImportRecord[],
  items: CustomerOrderItemImportRecord[],
  errors: ImportTransformError[],
) {
  for (const row of currentOrders) {
    const sourceId = String(row.id ?? "");
    if (!sourceId) continue;
    try {
      const createdAt = toIsoDateTime(row.created_at);
      const name = normalizeText(row.customer_name) ?? joinText([row.first_name, row.last_name]);
      const customerKey = accumulator.resolve({
        sourceSystem: "current_next",
        sourceId: `orders:${sourceId}`,
        name,
        firstName: normalizeText(row.first_name),
        lastName: normalizeText(row.last_name),
        company: normalizeText(row.organization_name),
        email: normalizeText(row.customer_email),
        phone: normalizeText(row.phone),
        addressLine1: normalizeText(row.address_line1),
        addressLine2: normalizeText(row.address_line2),
        suburb: normalizeText(row.suburb),
        state: normalizeText(row.state),
        postcode: normalizeText(row.postcode),
        country: "AU",
        seenAt: createdAt,
      });
      const history: CustomerOrderHistoryImportRecord = {
        customer_key: customerKey,
        source_system: "current_next",
        source_id: sourceId,
        source_order_number: normalizeText(row.order_number) ?? sourceId,
        display_order_number: normalizeText(row.order_number) ?? `current #${sourceId.slice(0, 8)}`,
        order_status: normalizeText(row.status),
        order_type: normalizeText(row.design_type),
        customer_name: name,
        customer_email: normalizeText(row.customer_email),
        phone: normalizeText(row.phone),
        company: normalizeText(row.organization_name),
        address_line1: normalizeText(row.address_line1),
        address_line2: normalizeText(row.address_line2),
        suburb: normalizeText(row.suburb),
        state: normalizeText(row.state),
        postcode: normalizeText(row.postcode),
        country: "AU",
        created_at_source: createdAt,
        due_date: toIsoDate(row.due_date),
        completed_at: toIsoDateTime(row.archived_at) ?? toIsoDateTime(row.shipped_at),
        paid_at: toIsoDateTime(row.paid_at),
        total_price: money(toNumber(row.total_price)),
        payment_total: money(toNumber(row.total_price)),
        refunded_total: row.refunded_at ? money(toNumber(row.total_price)) : 0,
        payment_summary: normalizeText(row.payment_method),
        payment_reference: normalizeText(row.payment_transaction_id),
        payment_provider: normalizeText(row.payment_provider),
        card_brand: null,
        card_last4: null,
        currency: "AUD",
        pickup: toBoolean(row.pickup),
        notes: normalizeText(row.notes),
        internal_notes: null,
        raw_sanitized: makeSafeObject({
          id: row.id,
          order_number: row.order_number,
          title: row.title,
          order_description: row.order_description,
          woo_order_id: row.woo_order_id,
          woo_order_status: row.woo_order_status,
          paid_at: row.paid_at,
          refunded_at: row.refunded_at,
          refund_reason: row.refund_reason,
          archived_at: row.archived_at,
          shipped_at: row.shipped_at,
        }),
      };
      orders.push(history);
      accumulator.addOrder(customerKey, history);
      items.push({
        order_source_system: "current_next",
        order_source_id: sourceId,
        source_system: "current_next",
        source_id: `${sourceId}:line`,
        source_order_id: sourceId,
        title: normalizeText(row.title) ?? normalizeText(row.order_description),
        design_type: normalizeText(row.design_type),
        design_text: normalizeText(row.design_text),
        flavor: normalizeText(row.flavor),
        quantity: toNumber(row.quantity),
        total_weight_kg: money(toNumber(row.total_weight_kg)),
        unit_price: null,
        total_price: money(toNumber(row.total_price)),
        made: toBoolean(row.made),
        colors: makeSafeObject({
          jacket: row.jacket,
          jacket_type: row.jacket_type,
          jacket_color_one: row.jacket_color_one,
          jacket_color_two: row.jacket_color_two,
          text: row.text_color,
          heart: row.heart_color,
          jar_lid: row.jar_lid_color,
        }),
        packaging_summary: normalizeText(row.packaging_option_id),
        asset_refs: makeSafeObject({
          logo_url: row.logo_url,
          label_image_url: row.label_image_url,
        }),
        raw_sanitized: makeSafeObject({
          category_id: row.category_id,
          packaging_option_id: row.packaging_option_id,
          label_type_id: row.label_type_id,
          labels_count: row.labels_count,
          ingredient_labels_count: row.ingredient_labels_count,
        }),
      });
    } catch (error) {
      errors.push(transformError("current_next", "orders", sourceId, error, { id: row.id, order_number: row.order_number }));
    }
  }
}

function lookup(rows: SqlRow[] | undefined, idColumn: string, ...valueColumns: string[]) {
  const result = new Map<string, string>();
  for (const row of rows ?? []) {
    const id = normalizeText(row[idColumn]);
    const value = valueColumns.map((column) => normalizeText(row[column])).find(Boolean);
    if (id && value) result.set(id, value);
  }
  return result;
}

function groupRows(rows: SqlRow[] | undefined, column: string) {
  const result = new Map<string, SqlRow[]>();
  for (const row of rows ?? []) {
    const key = normalizeText(row[column]);
    if (!key) continue;
    const group = result.get(key) ?? [];
    group.push(row);
    result.set(key, group);
  }
  return result;
}

function oldOrphanCartOrderSourceId(orderId: string) {
  return `orphan-cart:${orderId || "unknown"}`;
}

function summarizeOrphanOldCartItems(rows: SqlRow[], legacyOrderIds: Set<string>) {
  const summaries = new Map<string, { createdAt: string | null; total: number; itemCount: number }>();
  rows.forEach((row) => {
    const orderId = String(row.order_id ?? "");
    if (legacyOrderIds.has(orderId)) return;
    const existing = summaries.get(orderId) ?? { createdAt: null, total: 0, itemCount: 0 };
    summaries.set(orderId, {
      createdAt: earliestIso(existing.createdAt, toIsoDateTime(row.date_added)),
      total: existing.total + Number(toNumber(row.total) ?? 0),
      itemCount: existing.itemCount + 1,
    });
  });
  return summaries;
}

function summarizeOldPayments(rows: SqlRow[], paymentMethods: Map<string, string>) {
  let paidTotal = 0;
  let refundedTotal = 0;
  let latestPaymentAt: string | null = null;
  const descriptions: string[] = [];
  const references: string[] = [];

  rows.forEach((row) => {
    const amount = toNumber(row.payment_amount) ?? 0;
    if (amount >= 0) paidTotal += amount;
    if (amount < 0) refundedTotal += Math.abs(amount);
    latestPaymentAt = latestIso(latestPaymentAt, toIsoDateTime(row.payment_date));
    const method = paymentMethods.get(String(row.payment_method_id ?? "")) ?? null;
    const description = joinText([method, row.payment_description], " - ");
    if (description) descriptions.push(description);
    const reference = normalizeText(row.payment_reference);
    if (reference) references.push(reference);
  });

  return {
    paidTotal,
    refundedTotal,
    latestPaymentAt,
    summary: descriptions.length > 0 ? Array.from(new Set(descriptions)).join("; ") : null,
    references: references.length > 0 ? Array.from(new Set(references)).join(", ") : null,
  };
}

function extractPaymentReference(value: string | null) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return findPaymentReference(parsed);
  } catch {
    return null;
  }
}

function findPaymentReference(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const direct = pickString(record.id) ?? pickString(record.order_id);
  if (direct) return direct;
  const payment = record.payment;
  if (payment && typeof payment === "object") {
    const paymentRecord = payment as Record<string, unknown>;
    const paymentId = pickString(paymentRecord.id) ?? pickString(paymentRecord.order_id);
    if (paymentId) return paymentId;
  }
  const purchaseUnits = record.purchase_units;
  if (Array.isArray(purchaseUnits)) {
    for (const unit of purchaseUnits) {
      if (!unit || typeof unit !== "object") continue;
      const payments = (unit as Record<string, unknown>).payments;
      if (!payments || typeof payments !== "object") continue;
      const captures = (payments as Record<string, unknown>).captures;
      if (!Array.isArray(captures)) continue;
      const capture = captures.find((item) => item && typeof item === "object") as Record<string, unknown> | undefined;
      const captureId = capture ? pickString(capture.id) : null;
      if (captureId) return captureId;
    }
  }
  return null;
}

function pickString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function transformError(
  sourceSystem: ImportSourceSystem,
  sourceTable: string,
  sourceId: string | null,
  error: unknown,
  rawSanitized: Record<string, unknown>,
): ImportTransformError {
  return {
    sourceSystem,
    sourceTable,
    sourceId,
    message: error instanceof Error ? error.message : String(error),
    rawSanitized,
  };
}
