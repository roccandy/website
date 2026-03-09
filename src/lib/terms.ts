import { DEFAULT_TERMS_TEXT } from "@/lib/termsData";
import { buildTermsTree, normalizeTermsItems, type ManagedTermsItem, type ManagedTermsNode } from "@/lib/terms-shared";
import { supabaseServerClient } from "@/lib/supabase/server";

const TERMS_TABLE = "site_terms_items";

type SiteTermsRow = {
  id: string;
  parent_id: string | null;
  marker: string;
  title: string;
  body: string;
  sort_order: number;
};

function normalizeText(value: string | null | undefined) {
  return (value ?? "").replace(/\r\n/g, "\n").trim();
}

function isMissingTermsTableError(message: string) {
  return message.includes("site_terms_items") || message.includes("relation") || message.includes("schema cache");
}

function markerDepth(marker: string) {
  const trimmed = marker.trim();
  if (/^\d+\.$/.test(trimmed) || /^\d+$/.test(trimmed)) return 0;
  if (/^\d+\.\d+$/.test(trimmed)) return 1;
  if (/^[a-z]\)$/i.test(trimmed)) return 2;
  if (/^[ivxlcdm]+\.\)$/i.test(trimmed)) return 3;
  return 0;
}

function splitMarkerLine(line: string) {
  const match = line.match(/^(\d+(?:\.\d+)?\.?|[a-z]\)|[ivxlcdm]+\.\))\s*(.*)$/i);
  if (!match) return null;
  return {
    marker: normalizeText(match[1]),
    text: normalizeText(match[2]),
  };
}

function looksLikeTitle(value: string) {
  const letters = value.replace(/[^A-Za-z]+/g, "");
  if (!letters) return false;
  return letters === letters.toUpperCase();
}

function parseBodyLines(lines: string[]) {
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function buildDefaultTermsItems(): ManagedTermsItem[] {
  const lines = DEFAULT_TERMS_TEXT.split("\n");
  const items: ManagedTermsItem[] = [];
  const lastAtDepth = new Map<number, ManagedTermsItem>();
  let current: (ManagedTermsItem & { bodyLines: string[] }) | null = null;

  const flushCurrent = () => {
    if (!current) return;
    items.push({
      id: current.id,
      parentId: current.parentId,
      marker: current.marker,
      title: current.title,
      body: parseBodyLines(current.bodyLines.length > 0 ? current.bodyLines : current.body ? [current.body] : []),
      sortOrder: current.sortOrder,
    });
    current = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const parsed = splitMarkerLine(line.trim());
    if (parsed) {
      flushCurrent();
      const depth = markerDepth(parsed.marker);
      const parent = depth > 0 ? lastAtDepth.get(depth - 1) ?? null : null;
      const initialText = parsed.text;
      current = {
        id: crypto.randomUUID(),
        parentId: parent?.id ?? null,
        marker: parsed.marker,
        title: looksLikeTitle(initialText) ? initialText : "",
        body: looksLikeTitle(initialText) ? "" : initialText,
        bodyLines: looksLikeTitle(initialText) ? [] : initialText ? [initialText] : [],
        sortOrder: 0,
      };
      lastAtDepth.set(depth, current);
      for (const key of [...lastAtDepth.keys()]) {
        if (key > depth) lastAtDepth.delete(key);
      }
      continue;
    }

    if (!current) continue;
    if (!line.trim()) {
      if (current.bodyLines[current.bodyLines.length - 1] !== "") {
        current.bodyLines.push("");
      }
      continue;
    }
    current.bodyLines.push(line.trim());
  }

  flushCurrent();

  const counters = new Map<string | null, number>();
  return items.map((item) => {
    const nextSort = counters.get(item.parentId) ?? 0;
    counters.set(item.parentId, nextSort + 1);
    return { ...item, sortOrder: nextSort };
  });
}

async function readTermsItemsFromTable(): Promise<ManagedTermsItem[] | null> {
  const { data, error } = await supabaseServerClient
    .from(TERMS_TABLE)
    .select("id,parent_id,marker,title,body,sort_order")
    .order("parent_id", { ascending: true, nullsFirst: true })
    .order("sort_order", { ascending: true });

  if (error) {
    const message = error.message.toLowerCase();
    if (isMissingTermsTableError(message)) return null;
    throw new Error(error.message);
  }

  const rows = (data ?? []) as SiteTermsRow[];
  return normalizeTermsItems(
    rows.map((row) => ({
      id: row.id,
      parentId: row.parent_id,
      marker: row.marker,
      title: row.title,
      body: row.body,
      sortOrder: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : 0,
    }))
  );
}

export async function getManagedTermsItems(): Promise<ManagedTermsItem[]> {
  const fromTable = await readTermsItemsFromTable();
  if (fromTable && fromTable.length > 0) return fromTable;

  const fallback = buildDefaultTermsItems();
  if (fromTable) {
    await saveManagedTermsItems(fallback);
  }
  return fallback;
}

export async function getManagedTermsTree(): Promise<ManagedTermsNode[]> {
  const items = await getManagedTermsItems();
  return buildTermsTree(items);
}

export async function saveManagedTermsItems(items: ManagedTermsItem[]) {
  const normalized = normalizeTermsItems(items);

  const { error: clearError } = await supabaseServerClient
    .from(TERMS_TABLE)
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (clearError) {
    throw new Error(clearError.message);
  }

  if (normalized.length === 0) return;

  const rows: SiteTermsRow[] = normalized.map((item) => ({
    id: item.id,
    parent_id: item.parentId,
    marker: item.marker,
    title: item.title,
    body: item.body,
    sort_order: item.sortOrder,
  }));

  const { error: insertError } = await supabaseServerClient.from(TERMS_TABLE).insert(rows);
  if (insertError) {
    throw new Error(insertError.message);
  }
}
