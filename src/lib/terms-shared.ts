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

  return buildNodes(null);
}

export function flattenTermsTree(nodes: ManagedTermsNode[], parentId: string | null = null): ManagedTermsItem[] {
  return nodes.flatMap((node, index) => {
    const current: ManagedTermsItem = {
      id: isUuid(node.id) ? node.id : crypto.randomUUID(),
      parentId,
      marker: normalizeText(node.marker),
      title: normalizeText(node.title),
      body: normalizeText(node.body),
      sortOrder: index,
    };
    return [current, ...flattenTermsTree(node.children ?? [], current.id)];
  });
}
