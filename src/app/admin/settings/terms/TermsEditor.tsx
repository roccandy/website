"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ManagedTermsItem, ManagedTermsNode } from "@/lib/terms-shared";
import { flattenTermsTree } from "@/lib/terms-shared";
import { saveTermsTree } from "./actions";

type Props = {
  items: ManagedTermsNode[];
};

type EditorNode = ManagedTermsNode;

function toRoman(value: number) {
  const numerals = [
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

function nextMarkerFor(parent: EditorNode | null, siblingCount: number) {
  const nextIndex = siblingCount + 1;
  if (!parent) return `${nextIndex}.`;

  const parentMarker = parent.marker.trim();
  if (/^\d+\.$/.test(parentMarker) || /^\d+$/.test(parentMarker)) {
    return `${parentMarker.replace(/\.$/, "")}.${nextIndex}`;
  }
  if (/^\d+\.\d+$/.test(parentMarker)) {
    return `${String.fromCharCode(96 + Math.min(nextIndex, 26))})`;
  }
  if (/^[a-z]\)$/i.test(parentMarker)) {
    return `${toRoman(nextIndex)}.)`;
  }
  return "";
}

function createNode(parent: EditorNode | null, siblingCount: number): EditorNode {
  return {
    id: crypto.randomUUID(),
    parentId: parent?.id ?? null,
    marker: nextMarkerFor(parent, siblingCount),
    title: "",
    body: "",
    sortOrder: siblingCount,
    children: [],
  };
}

function updateNode(nodes: EditorNode[], id: string, updater: (node: EditorNode) => EditorNode): EditorNode[] {
  return nodes.map((node) => {
    if (node.id === id) {
      return updater(node);
    }
    if (node.children.length === 0) return node;
    return { ...node, children: updateNode(node.children, id, updater) };
  });
}

function deleteNode(nodes: EditorNode[], id: string): EditorNode[] {
  return nodes
    .filter((node) => node.id !== id)
    .map((node) => ({
      ...node,
      children: deleteNode(node.children, id),
    }));
}

function reorderSiblings(nodes: EditorNode[], parentId: string | null, activeId: string, overId: string): EditorNode[] {
  if (parentId === null) {
    const oldIndex = nodes.findIndex((node) => node.id === activeId);
    const newIndex = nodes.findIndex((node) => node.id === overId);
    if (oldIndex === -1 || newIndex === -1) return nodes;
    return arrayMove(nodes, oldIndex, newIndex).map((node, index) => ({ ...node, sortOrder: index }));
  }

  return nodes.map((node) => {
    if (node.id !== parentId) {
      return { ...node, children: reorderSiblings(node.children, parentId, activeId, overId) };
    }
    const oldIndex = node.children.findIndex((child) => child.id === activeId);
    const newIndex = node.children.findIndex((child) => child.id === overId);
    if (oldIndex === -1 || newIndex === -1) return node;
    return {
      ...node,
      children: arrayMove(node.children, oldIndex, newIndex).map((child, index) => ({ ...child, sortOrder: index })),
    };
  });
}

function reindexTree(nodes: EditorNode[], parentId: string | null = null): EditorNode[] {
  return nodes.map((node, index) => ({
    ...node,
    parentId,
    sortOrder: index,
    children: reindexTree(node.children, node.id),
  }));
}

function SortableTermCard({
  item,
  depth,
  index,
  onFieldChange,
  onAddChild,
  onDelete,
  onReorderChildren,
}: {
  item: EditorNode;
  depth: number;
  index: number;
  onFieldChange: (id: string, field: "marker" | "title" | "body", value: string) => void;
  onAddChild: (id: string) => void;
  onDelete: (id: string) => void;
  onReorderChildren: (parentId: string | null, activeId: string, overId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border border-zinc-200 bg-white p-4 shadow-sm ${isDragging ? "opacity-80" : ""}`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
          {depth === 0 ? `Section ${index + 1}` : depth === 1 ? `Sub item ${index + 1}` : `Nested item ${index + 1}`}
        </p>
        <button
          type="button"
          className="inline-flex cursor-grab items-center rounded border border-zinc-200 px-2 py-1 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-50 active:cursor-grabbing"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          Drag
        </button>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-[150px_1fr]">
        <label className="space-y-1 text-sm text-zinc-700">
          <span className="text-xs text-zinc-500">Marker</span>
          <input
            type="text"
            value={item.marker}
            onChange={(event) => onFieldChange(item.id, "marker", event.target.value)}
            placeholder="e.g. 1. or 3.1 or a)"
            className="w-full rounded border border-zinc-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1 text-sm text-zinc-700">
          <span className="text-xs text-zinc-500">Title</span>
          <input
            type="text"
            value={item.title}
            onChange={(event) => onFieldChange(item.id, "title", event.target.value)}
            placeholder="Section heading"
            className="w-full rounded border border-zinc-200 px-3 py-2 text-sm"
          />
        </label>
      </div>

      <label className="mt-3 block space-y-1 text-sm text-zinc-700">
        <span className="text-xs text-zinc-500">Body</span>
        <textarea
          value={item.body}
          onChange={(event) => onFieldChange(item.id, "body", event.target.value)}
          rows={depth === 0 ? 5 : 3}
          placeholder="Term text"
          className="w-full rounded border border-zinc-200 px-3 py-2 text-sm"
        />
      </label>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onAddChild(item.id)}
          className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
        >
          Add child
        </button>
        <button
          type="button"
          onClick={() => onDelete(item.id)}
          className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
        >
          Delete
        </button>
      </div>

      {item.children.length > 0 ? (
        <div className="mt-4 border-l border-zinc-200 pl-4">
          <SortableTermsList
            items={item.children}
            parentId={item.id}
            depth={depth + 1}
            onFieldChange={onFieldChange}
            onAddChild={onAddChild}
            onDelete={onDelete}
            onReorderChildren={onReorderChildren}
          />
        </div>
      ) : null}
    </article>
  );
}

function SortableTermsList({
  items,
  parentId,
  depth,
  onFieldChange,
  onAddChild,
  onDelete,
  onReorderChildren,
}: {
  items: EditorNode[];
  parentId: string | null;
  depth: number;
  onFieldChange: (id: string, field: "marker" | "title" | "body", value: string) => void;
  onAddChild: (id: string) => void;
  onDelete: (id: string) => void;
  onReorderChildren: (parentId: string | null, activeId: string, overId: string) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const ids = useMemo(() => items.map((item) => item.id), [items]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;
    onReorderChildren(parentId, activeId, overId);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {items.map((item, index) => (
            <SortableTermCard
              key={item.id}
              item={item}
              depth={depth}
              index={index}
              onFieldChange={onFieldChange}
              onAddChild={onAddChild}
              onDelete={onDelete}
              onReorderChildren={onReorderChildren}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

export default function TermsEditor({ items }: Props) {
  const router = useRouter();
  const [tree, setTree] = useState<EditorNode[]>(items);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setTree(items);
  }, [items]);

  const updateField = (id: string, field: "marker" | "title" | "body", value: string) => {
    setTree((current) => updateNode(current, id, (node) => ({ ...node, [field]: value })));
  };

  const addRoot = () => {
    setTree((current) => [...current, createNode(null, current.length)]);
  };

  const addChild = (id: string) => {
    setTree((current) =>
      updateNode(current, id, (node) => ({
        ...node,
        children: [...node.children, createNode(node, node.children.length)],
      }))
    );
  };

  const remove = (id: string) => {
    setTree((current) => deleteNode(current, id));
  };

  const reorder = (parentId: string | null, activeId: string, overId: string) => {
    setTree((current) => reorderSiblings(current, parentId, activeId, overId));
  };

  const handleSave = () => {
    setError(null);
    const payload: ManagedTermsItem[] = flattenTermsTree(reindexTree(tree));
    startTransition(async () => {
      const result = await saveTermsTree(payload);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs text-zinc-500">Add, edit, nest, and drag to reorder terms items.</p>
          {isPending ? <p className="text-xs text-zinc-500">Saving terms...</p> : null}
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={addRoot}
            className="rounded-md border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            Add top-level section
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-md bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
          >
            Save all changes
          </button>
        </div>
      </div>

      {tree.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-sm">
          No terms yet. Add the first section above.
        </div>
      ) : (
        <SortableTermsList
          items={tree}
          parentId={null}
          depth={0}
          onFieldChange={updateField}
          onAddChild={addChild}
          onDelete={remove}
          onReorderChildren={reorder}
        />
      )}
    </div>
  );
}
