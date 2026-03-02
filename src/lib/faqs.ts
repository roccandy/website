import { FAQ_ITEMS } from "@/lib/faqData";
import { supabaseServerClient } from "@/lib/supabase/server";

const LEGACY_FAQ_BUCKET = "site-content";
const LEGACY_FAQ_PATH = "faqs.json";
const FAQ_TABLE = "site_faqs";

export type FaqContent = {
  question: string;
  answerHtml: string;
};

export type ManagedFaqItem = FaqContent & {
  id: string;
  sortOrder: number;
};

type LegacyStoredFaqPayload = {
  updatedAt?: string;
  items?: ManagedFaqItem[];
};

type SiteFaqRow = {
  id: string;
  question: string;
  answer_html: string;
  sort_order: number;
};

function normalizeText(value: string | null | undefined) {
  return (value ?? "").replace(/\r\n/g, "\n").trim();
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function sortFaqItems(items: ManagedFaqItem[]) {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder);
}

function normalizeFaqItems(items: ManagedFaqItem[]): ManagedFaqItem[] {
  return sortFaqItems(items)
    .map((item, index) => {
      const normalizedId = normalizeText(item.id);
      return {
        id: isUuid(normalizedId) ? normalizedId : crypto.randomUUID(),
        question: normalizeText(item.question),
        answerHtml: normalizeText(item.answerHtml),
        sortOrder: index,
      };
    })
    .filter((item) => item.question && item.answerHtml);
}

function buildFallbackFaqItems(): ManagedFaqItem[] {
  return FAQ_ITEMS.map((item, index) => ({
    id: crypto.randomUUID(),
    question: item.question,
    answerHtml: item.answerHtml,
    sortOrder: index,
  }));
}

function isMissingFaqTableError(message: string) {
  return (
    message.includes("site_faqs") ||
    message.includes("relation") ||
    message.includes("schema cache")
  );
}

function looksLikeMissingStorage(message: string) {
  return (
    message.includes("not found") ||
    message.includes("does not exist") ||
    message.includes("no such bucket") ||
    message.includes("the resource was not found")
  );
}

async function readFaqItemsFromTable(): Promise<ManagedFaqItem[] | null> {
  const client = supabaseServerClient;
  const { data, error } = await client
    .from(FAQ_TABLE)
    .select("id,question,answer_html,sort_order")
    .order("sort_order", { ascending: true });

  if (error) {
    const message = error.message.toLowerCase();
    if (isMissingFaqTableError(message)) {
      return null;
    }
    throw new Error(error.message);
  }

  const rows = (data ?? []) as SiteFaqRow[];
  const mapped = rows.map((row, index) => ({
    id: row.id,
    question: normalizeText(row.question),
    answerHtml: normalizeText(row.answer_html),
    sortOrder: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : index,
  }));

  return normalizeFaqItems(mapped);
}

async function readLegacyFaqItemsFromStorage(): Promise<ManagedFaqItem[] | null> {
  const client = supabaseServerClient;
  let data: Blob | null = null;
  let error: { message?: string } | null = null;

  try {
    const response = await client.storage.from(LEGACY_FAQ_BUCKET).download(LEGACY_FAQ_PATH);
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
    throw new Error(error?.message ?? "Unable to read legacy FAQ data.");
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
  const payload = parsed as LegacyStoredFaqPayload;
  if (!Array.isArray(payload.items)) return null;

  const valid = payload.items
    .map((item, index) => {
      const id = normalizeText(item.id);
      const question = normalizeText(item.question);
      const answerHtml = normalizeText(item.answerHtml);
      const sortOrder = Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : index;
      if (!question || !answerHtml) return null;
      return {
        id: isUuid(id) ? id : crypto.randomUUID(),
        question,
        answerHtml,
        sortOrder,
      } satisfies ManagedFaqItem;
    })
    .filter((item): item is ManagedFaqItem => Boolean(item));

  return valid.length > 0 ? normalizeFaqItems(valid) : null;
}

export async function getManagedFaqItems(): Promise<ManagedFaqItem[]> {
  const fromTable = await readFaqItemsFromTable();
  if (fromTable && fromTable.length > 0) return fromTable;

  const legacy = await readLegacyFaqItemsFromStorage();
  if (legacy && legacy.length > 0) {
    if (fromTable) {
      // Table exists but is empty: migrate legacy records into SQL table automatically.
      await saveManagedFaqItems(legacy);
    }
    return legacy;
  }

  const fallback = buildFallbackFaqItems();
  if (fromTable) {
    // Table exists but no records anywhere: seed defaults once.
    await saveManagedFaqItems(fallback);
  }
  return fallback;
}

export async function getFaqContentItems(): Promise<FaqContent[]> {
  const items = await getManagedFaqItems();
  return items.map(({ question, answerHtml }) => ({ question, answerHtml }));
}

export async function saveManagedFaqItems(items: ManagedFaqItem[]) {
  const normalized = normalizeFaqItems(items);
  const client = supabaseServerClient;

  const { error: clearError } = await client
    .from(FAQ_TABLE)
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (clearError) {
    throw new Error(clearError.message);
  }

  if (normalized.length === 0) return;

  const rows: SiteFaqRow[] = normalized.map((item, index) => ({
    id: item.id,
    question: item.question,
    answer_html: item.answerHtml,
    sort_order: index,
  }));

  const { error: insertError } = await client.from(FAQ_TABLE).insert(rows);
  if (insertError) {
    throw new Error(insertError.message);
  }
}
