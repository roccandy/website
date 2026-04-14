"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ManagedFaqItem } from "@/lib/faqs";
import { TextContentEditorField } from "../pages/TextContentEditorField";
import { deleteFaq, updateFaq, updateFaqOrder } from "./actions";

type Props = {
  items: ManagedFaqItem[];
  canWriteSeo: boolean;
};

function SortableFaqItem({
  item,
  index,
  canWriteSeo,
}: {
  item: ManagedFaqItem;
  index: number;
  canWriteSeo: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const formId = `faq-edit-${item.id}`;
  const [isOpen, setIsOpen] = useState(false);

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm ${isDragging ? "opacity-80" : ""}`}
    >
      <details open={isOpen} onToggle={(event) => setIsOpen(event.currentTarget.open)}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">FAQ #{index + 1}</p>
              {!item.showOnFaqPage ? (
                <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  Hidden
                </span>
              ) : null}
            </div>
            <p className="truncate text-sm font-semibold text-zinc-900">{item.question}</p>
          </div>

          <div className="flex items-center gap-2">
            <label
              className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-700"
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <input
                type="checkbox"
                name="showOnFaqPage"
                form={formId}
                defaultChecked={item.showOnFaqPage}
                disabled={!canWriteSeo}
                className="h-4 w-4"
              />
              <span>Main FAQ page</span>
            </label>

            {canWriteSeo ? (
              <button
                type="submit"
                form={formId}
                className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
                onClick={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
              >
                Save
              </button>
            ) : null}

            {canWriteSeo ? (
              <button
                type="button"
                className="inline-flex cursor-grab items-center rounded border border-zinc-200 px-2 py-1 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-50 active:cursor-grabbing"
                aria-label={`Drag to reorder FAQ ${index + 1}`}
                onClick={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
                {...attributes}
                {...listeners}
              >
                Drag
              </button>
            ) : null}

            <span
              aria-hidden="true"
              className={`inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
            >
              ▾
            </span>
          </div>
        </summary>

        <div className="border-t border-zinc-200 px-4 py-4">
          <form id={formId} action={updateFaq} className="space-y-4">
            <input type="hidden" name="id" value={item.id} />

            <label className="block text-sm text-zinc-700">
              <span className="text-xs text-zinc-500">Question</span>
              <input
                type="text"
                name="question"
                defaultValue={item.question}
                required
                readOnly={!canWriteSeo}
                className="mt-1 w-full rounded border border-zinc-200 px-3 py-2 text-sm"
              />
            </label>

            <label className="block text-sm text-zinc-700">
              <span className="text-xs text-zinc-500">Answer</span>
              <div className="mt-1">
                <TextContentEditorField
                  name="answerText"
                  defaultHtml={item.answerHtml}
                  rows={6}
                  readOnly={!canWriteSeo}
                  placeholder="Type the FAQ answer"
                />
              </div>
            </label>

            <p className="text-xs leading-relaxed text-zinc-500">
              FAQ answers use the same text editor as the site page content editor. New lines, bold text, lists, and links render on the site without HTML.
            </p>
          </form>

          {canWriteSeo ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="submit"
                form={formId}
                className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800"
              >
                Save
              </button>

              <form action={deleteFaq} className="ml-auto">
                <input type="hidden" name="id" value={item.id} />
                <button
                  type="submit"
                  className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </form>
            </div>
          ) : null}
        </div>
      </details>
    </article>
  );
}

export default function FaqAdminList({ items, canWriteSeo }: Props) {
  const router = useRouter();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [list, setList] = useState<ManagedFaqItem[]>(items);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setList(items);
  }, [items]);

  const ids = useMemo(() => list.map((item) => item.id), [list]);

  const handleDragEnd = (event: DragEndEvent) => {
    if (!canWriteSeo) return;
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const oldIndex = list.findIndex((item) => item.id === activeId);
    const newIndex = list.findIndex((item) => item.id === overId);
    if (oldIndex === -1 || newIndex === -1) return;

    const previous = list;
    const next = arrayMove(list, oldIndex, newIndex).map((item, index) => ({ ...item, sortOrder: index }));
    setList(next);
    setError(null);

    startTransition(async () => {
      const result = await updateFaqOrder(next.map((item, index) => ({ id: item.id, sortOrder: index })));
      if (result.error) {
        setList(previous);
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500">
        {canWriteSeo
          ? "Click a question to open the editor. Drag rows to reorder them. The checkbox controls whether the FAQ appears on the main FAQ page."
          : "Read-only FAQ view."}
      </p>
      {isPending ? <p className="text-xs text-zinc-500">Saving order...</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      {list.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-sm">
          No FAQs yet. Add the first one above.
        </div>
      ) : canWriteSeo ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {list.map((item, index) => (
                <SortableFaqItem key={item.id} item={item} index={index} canWriteSeo={canWriteSeo} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="space-y-3">
          {list.map((item, index) => (
            <SortableFaqItem key={item.id} item={item} index={index} canWriteSeo={canWriteSeo} />
          ))}
        </div>
      )}
    </div>
  );
}
