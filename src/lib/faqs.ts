import { FAQ_ITEMS } from "@/lib/faqData";
import { supabaseServerClient } from "@/lib/supabase/server";

const FAQ_BUCKET = "site-content";
const FAQ_PATH = "faqs.json";

export type FaqContent = {
  question: string;
  answerHtml: string;
};

export type ManagedFaqItem = FaqContent & {
  id: string;
  sortOrder: number;
};

type StoredFaqPayload = {
  updatedAt: string;
  items: ManagedFaqItem[];
};

function normalizeText(value: string | null | undefined) {
  return (value ?? "").replace(/\r\n/g, "\n").trim();
}

function sortFaqItems(items: ManagedFaqItem[]) {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder);
}

function normalizeFaqItems(items: ManagedFaqItem[]): ManagedFaqItem[] {
  return sortFaqItems(items)
    .map((item, index) => ({
      id: normalizeText(item.id) || crypto.randomUUID(),
      question: normalizeText(item.question),
      answerHtml: normalizeText(item.answerHtml),
      sortOrder: index,
    }))
    .filter((item) => item.question && item.answerHtml);
}

function buildFallbackFaqItems(): ManagedFaqItem[] {
  return FAQ_ITEMS.map((item, index) => ({
    id: `legacy-${index + 1}`,
    question: item.question,
    answerHtml: item.answerHtml,
    sortOrder: index,
  }));
}

function looksLikeMissingStorage(message: string) {
  return (
    message.includes("not found") ||
    message.includes("does not exist") ||
    message.includes("no such bucket") ||
    message.includes("the resource was not found")
  );
}

async function readStoredFaqPayload(): Promise<StoredFaqPayload | null> {
  const client = supabaseServerClient;
  const { data, error } = await client.storage.from(FAQ_BUCKET).download(FAQ_PATH);
  if (error || !data) {
    const message = (error?.message ?? "").toLowerCase();
    if (looksLikeMissingStorage(message)) return null;
    throw new Error(error?.message ?? "Unable to read FAQ data.");
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
  const payload = parsed as Partial<StoredFaqPayload>;
  if (!Array.isArray(payload.items)) return null;

  const valid = payload.items
    .map((item, index) => {
      const entry = item as Partial<ManagedFaqItem>;
      const id = normalizeText(entry.id);
      const question = normalizeText(entry.question);
      const answerHtml = normalizeText(entry.answerHtml);
      const sortOrder = Number.isFinite(Number(entry.sortOrder)) ? Number(entry.sortOrder) : index;
      if (!id || !question || !answerHtml) return null;
      return {
        id,
        question,
        answerHtml,
        sortOrder,
      } satisfies ManagedFaqItem;
    })
    .filter((item): item is ManagedFaqItem => Boolean(item));

  if (valid.length === 0) return null;

  return {
    updatedAt: payload.updatedAt ?? "",
    items: normalizeFaqItems(valid),
  };
}

async function ensureFaqBucket() {
  const client = supabaseServerClient;
  const { data: buckets, error } = await client.storage.listBuckets();
  if (error) throw new Error(error.message);
  if (buckets?.some((bucket) => bucket.name === FAQ_BUCKET)) return;

  const { error: createError } = await client.storage.createBucket(FAQ_BUCKET, {
    public: false,
  });
  if (createError && !looksLikeMissingStorage(createError.message.toLowerCase())) {
    const message = createError.message.toLowerCase();
    if (!message.includes("already exists")) {
      throw new Error(createError.message);
    }
  }
}

export async function getManagedFaqItems(): Promise<ManagedFaqItem[]> {
  const stored = await readStoredFaqPayload();
  if (stored && stored.items.length > 0) return stored.items;
  return buildFallbackFaqItems();
}

export async function getFaqContentItems(): Promise<FaqContent[]> {
  const items = await getManagedFaqItems();
  return items.map(({ question, answerHtml }) => ({ question, answerHtml }));
}

export async function saveManagedFaqItems(items: ManagedFaqItem[]) {
  const normalized = normalizeFaqItems(items);
  await ensureFaqBucket();

  const payload: StoredFaqPayload = {
    updatedAt: new Date().toISOString(),
    items: normalized,
  };

  const bytes = Buffer.from(JSON.stringify(payload, null, 2), "utf8");
  const { error } = await supabaseServerClient.storage.from(FAQ_BUCKET).upload(FAQ_PATH, bytes, {
    upsert: true,
    contentType: "application/json; charset=utf-8",
  });
  if (error) {
    throw new Error(error.message);
  }
}
