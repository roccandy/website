import { supabaseServerClient } from "@/lib/supabase/server";

const LABEL_SETTINGS_BUCKET = "site-content";
const LABEL_SETTINGS_PATH = "label-settings.json";

export type ManagedLabelSettings = {
  ingredientLabelPrice: number;
  ingredientLabelTypeId: string | null;
};

type StoredLabelSettingsPayload = {
  updatedAt: string;
  ingredientLabelPrice: number;
  ingredientLabelTypeId: string | null;
};

const DEFAULT_LABEL_SETTINGS: ManagedLabelSettings = {
  ingredientLabelPrice: 0,
  ingredientLabelTypeId: null,
};

function normalizeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, parsed);
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const next = value.trim();
  return next || null;
}

function looksLikeMissingStorage(message: string) {
  return (
    message.includes("not found") ||
    message.includes("does not exist") ||
    message.includes("no such bucket") ||
    message.includes("the resource was not found")
  );
}

async function readStoredLabelSettings(): Promise<ManagedLabelSettings | null> {
  const client = supabaseServerClient;
  let data: Blob | null = null;
  let error: { message?: string } | null = null;

  try {
    const response = await client.storage.from(LABEL_SETTINGS_BUCKET).download(LABEL_SETTINGS_PATH);
    data = response.data ?? null;
    error = response.error ? { message: response.error.message } : null;
  } catch (err) {
    const message = err instanceof Error ? err.message.toLowerCase() : "";
    if (looksLikeMissingStorage(message) || message.includes('"url"')) {
      return null;
    }
    throw err;
  }

  if (error || !data) {
    const message = (error?.message ?? "").toLowerCase();
    if (looksLikeMissingStorage(message) || message.includes('"url"')) return null;
    throw new Error(error?.message ?? "Unable to read label settings.");
  }

  const raw = await data.text();
  if (!raw.trim()) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") return null;
  const payload = parsed as Partial<StoredLabelSettingsPayload>;
  return {
    ingredientLabelPrice: normalizeNumber(payload.ingredientLabelPrice, 0),
    ingredientLabelTypeId: normalizeString(payload.ingredientLabelTypeId),
  };
}

async function ensureLabelSettingsBucket() {
  const client = supabaseServerClient;
  const { data: buckets, error } = await client.storage.listBuckets();
  if (error) throw new Error(error.message);
  if (buckets?.some((bucket) => bucket.name === LABEL_SETTINGS_BUCKET)) return;

  const { error: createError } = await client.storage.createBucket(LABEL_SETTINGS_BUCKET, {
    public: false,
  });
  if (createError) {
    const message = createError.message.toLowerCase();
    if (!message.includes("already exists")) {
      throw new Error(createError.message);
    }
  }
}

export async function getManagedLabelSettings(): Promise<ManagedLabelSettings> {
  try {
    const stored = await readStoredLabelSettings();
    if (stored) return stored;
  } catch {
    // Fail-safe for public quote rendering if storage access is unavailable.
  }
  return DEFAULT_LABEL_SETTINGS;
}

export async function saveManagedLabelSettings(settings: ManagedLabelSettings) {
  const normalized: ManagedLabelSettings = {
    ingredientLabelPrice: normalizeNumber(settings.ingredientLabelPrice, 0),
    ingredientLabelTypeId: normalizeString(settings.ingredientLabelTypeId),
  };

  await ensureLabelSettingsBucket();
  const payload: StoredLabelSettingsPayload = {
    updatedAt: new Date().toISOString(),
    ingredientLabelPrice: normalized.ingredientLabelPrice,
    ingredientLabelTypeId: normalized.ingredientLabelTypeId,
  };

  const bytes = Buffer.from(JSON.stringify(payload, null, 2), "utf8");
  const { error } = await supabaseServerClient.storage
    .from(LABEL_SETTINGS_BUCKET)
    .upload(LABEL_SETTINGS_PATH, bytes, {
      upsert: true,
      contentType: "application/json; charset=utf-8",
    });

  if (error) {
    throw new Error(error.message);
  }
}
