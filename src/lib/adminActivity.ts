import type { AdminRole } from "@/types/next-auth";
import { getAdminSession } from "@/lib/adminAuth";
import { supabaseAdminClient } from "@/lib/supabase/admin";

const ADMIN_ACTIVITY_TABLE = "admin_activity_log";
const ADMIN_ACTIVITY_SELECT =
  "id,actor_user_id,actor_email,actor_name,actor_role,area,action,entity_type,entity_id,entity_label,summary,path,changed_fields,metadata,created_at";

type AdminActivityRow = {
  id: string;
  actor_user_id?: string | null;
  actor_email?: string | null;
  actor_name?: string | null;
  actor_role?: string | null;
  area: string;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  entity_label?: string | null;
  summary: string;
  path?: string | null;
  changed_fields?: string[] | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
};

export type AdminActivityEntry = {
  id: string;
  actorUserId: string | null;
  actorEmail: string | null;
  actorName: string | null;
  actorRole: AdminRole | string | null;
  area: string;
  action: string;
  entityType: string;
  entityId: string | null;
  entityLabel: string | null;
  summary: string;
  path: string | null;
  changedFields: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
};

const PRODUCTION_ENTITY_TYPES = new Set([
  "production-slot",
  "production-block",
  "production-settings",
  "production-days",
  "quote-blockout-window",
]);

const PRODUCTION_CHANGED_FIELDS = new Set([
  "Production slot",
  "Production block",
  "Order status",
  "Slots per day",
  "Max total kg",
  "Quote blockout window",
  "Default no-production days",
  "Blocked dates",
]);

export type AdminActivityInput = {
  area: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  entityLabel?: string | null;
  summary: string;
  path?: string | null;
  changedFields?: string[];
  metadata?: Record<string, unknown>;
};

function normalizeText(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function normalizeChangedFields(values: string[] | undefined) {
  return Array.from(new Set((values ?? []).map((value) => value.trim()).filter(Boolean))).slice(0, 12);
}

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeys);
  }
  if (!value || typeof value !== "object") {
    if (typeof value === "string") return value.trim();
    return value ?? null;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nested]) => [key, sortObjectKeys(nested)]),
  );
}

function sanitizeMetadata(value: Record<string, unknown> | undefined) {
  if (!value) return {};
  try {
    return JSON.parse(JSON.stringify(sortObjectKeys(value))) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function mapRow(row: AdminActivityRow): AdminActivityEntry {
  return {
    id: row.id,
    actorUserId: row.actor_user_id ?? null,
    actorEmail: row.actor_email ?? null,
    actorName: row.actor_name ?? null,
    actorRole: row.actor_role ?? null,
    area: row.area,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id ?? null,
    entityLabel: row.entity_label ?? null,
    summary: row.summary,
    path: row.path ?? null,
    changedFields: row.changed_fields ?? [],
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}

function isMissingTableError(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("admin_activity_log") && (normalized.includes("relation") || normalized.includes("schema cache"));
}

export async function logAdminActivity(input: AdminActivityInput) {
  try {
    const session = await getAdminSession();
    if (!session?.user) return;

    const { error } = await supabaseAdminClient.from(ADMIN_ACTIVITY_TABLE).insert({
      actor_user_id: normalizeText(session.user.id),
      actor_email: normalizeText(session.user.email ?? null),
      actor_name: normalizeText(session.user.name ?? null),
      actor_role: normalizeText(session.user.role),
      area: input.area.trim(),
      action: input.action.trim(),
      entity_type: input.entityType.trim(),
      entity_id: normalizeText(input.entityId),
      entity_label: normalizeText(input.entityLabel),
      summary: input.summary.trim(),
      path: normalizeText(input.path),
      changed_fields: normalizeChangedFields(input.changedFields),
      metadata: sanitizeMetadata(input.metadata),
    });

    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    console.error("Failed to write admin activity log:", error);
  }
}

export async function listRecentAdminActivity(limit = 12) {
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 200);
  const { data, error } = await supabaseAdminClient
    .from(ADMIN_ACTIVITY_TABLE)
    .select(ADMIN_ACTIVITY_SELECT)
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error) {
    if (isMissingTableError(error.message)) return [];
    throw new Error(error.message);
  }

  return ((data ?? []) as AdminActivityRow[]).map(mapRow);
}

export function isProductionActivity(entry: AdminActivityEntry) {
  if (PRODUCTION_ENTITY_TYPES.has(entry.entityType)) return true;
  if (entry.path === "/admin/settings/production") return true;
  return entry.changedFields.some((field) => PRODUCTION_CHANGED_FIELDS.has(field));
}

export function isNonProductionActivity(entry: AdminActivityEntry) {
  return !isProductionActivity(entry);
}

export function getChangedFieldLabels(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  labels: Record<string, string>,
) {
  return Object.entries(labels)
    .filter(([key]) => JSON.stringify(sortObjectKeys(before[key])) !== JSON.stringify(sortObjectKeys(after[key])))
    .map(([, label]) => label);
}
