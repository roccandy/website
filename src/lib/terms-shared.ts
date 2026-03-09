export type ManagedTermsItem = {
  id: string;
  parentId: string | null;
  marker: string;
  title: string;
  body: string;
  sortOrder: number;
};

export type ManagedTermsNode = ManagedTermsItem & {
  children: ManagedTermsNode[];
};

function normalizeText(value: string | null | undefined) {
  return (value ?? "").replace(/\r\n/g, "\n").trim();
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function normalizeTermsItems(items: ManagedTermsItem[]): ManagedTermsItem[] {
  return items.map((item) => ({
    id: isUuid(normalizeText(item.id)) ? normalizeText(item.id) : crypto.randomUUID(),
    parentId: isUuid(normalizeText(item.parentId)) ? normalizeText(item.parentId) : null,
    marker: normalizeText(item.marker),
    title: normalizeText(item.title),
    body: normalizeText(item.body),
    sortOrder: Number.isFinite(item.sortOrder) ? item.sortOrder : 0,
  }));
}

function toRoman(value: number) {
  const numerals = [
    [1000, "m"],
    [900, "cm"],
    [500, "d"],
    [400, "cd"],
    [100, "c"],
    [90, "xc"],
    [50, "l"],
    [40, "xl"],
    [10, "x"],
    [9, "ix"],
    [5, "v"],
    [4, "iv"],
    [1, "i"],
  ] as const;
  let remaining = Math.max(1, value);
  let result = "";
  for (const [amount, symbol] of numerals) {
    while (remaining >= amount) {
      result += symbol;
      remaining -= amount;
    }
  }
  return result;
}

export function computeTermsMarker(path: number[]) {
  if (path.length === 0) return "";
  if (path.length === 1) return String(path[0] + 1);
  if (path.length === 2) return `${path[0] + 1}.${path[1] + 1}`;
  if (path.length === 3) return String.fromCharCode(97 + (path[2] % 26));
  return toRoman(path[path.length - 1] + 1);
}

export function assignTermsMarkers(nodes: ManagedTermsNode[], path: number[] = []): ManagedTermsNode[] {
  return nodes.map((node, index) => {
    const nextPath = [...path, index];
    return {
      ...node,
      sortOrder: index,
      marker: computeTermsMarker(nextPath),
      children: assignTermsMarkers(node.children, nextPath),
    };
  });
}

export function buildTermsTree(items: ManagedTermsItem[]): ManagedTermsNode[] {
  const normalized = normalizeTermsItems(items);
  const childrenByParent = new Map<string | null, ManagedTermsItem[]>();
  for (const item of normalized) {
    const group = childrenByParent.get(item.parentId) ?? [];
    group.push(item);
    childrenByParent.set(item.parentId, group);
  }

  const buildNodes = (parentId: string | null): ManagedTermsNode[] =>
    (childrenByParent.get(parentId) ?? [])
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((item, index) => ({
        ...item,
        sortOrder: index,
        children: buildNodes(item.id),
      }));

  return assignTermsMarkers(buildNodes(null));
}

export function flattenTermsTree(
  nodes: ManagedTermsNode[],
  parentId: string | null = null,
  path: number[] = []
): ManagedTermsItem[] {
  return nodes.flatMap((node, index) => {
    const nextPath = [...path, index];
    const current: ManagedTermsItem = {
      id: isUuid(node.id) ? node.id : crypto.randomUUID(),
      parentId,
      marker: computeTermsMarker(nextPath),
      title: normalizeText(node.title),
      body: normalizeText(node.body),
      sortOrder: index,
    };
    return [current, ...flattenTermsTree(node.children ?? [], current.id, nextPath)];
  });
}
