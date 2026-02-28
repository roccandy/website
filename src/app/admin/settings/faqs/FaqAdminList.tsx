"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ManagedFaqItem } from "@/lib/faqs";
import { deleteFaq, updateFaq, updateFaqOrder } from "./actions";

type Props = {
  items: ManagedFaqItem[];
};

function SortableFaqItem({ item, index }: { item: ManagedFaqItem; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const formId = `faq-edit-${item.id}`;

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border border-zinc-200 bg-white p-4 shadow-sm ${isDragging ? "opacity-80" : ""}`}
    >
      <form id={formId} action={updateFaq} className="space-y-3">
        <input type="hidden" name="id" value={item.id} />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">FAQ #{index + 1}</p>
          <button
            type="button"
            className="inline-flex cursor-grab items-center rounded border border-zinc-200 px-2 py-1 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-50 active:cursor-grabbing"
            aria-label={`Drag to reorder FAQ ${index + 1}`}
            {...attributes}
            {...listeners}
          >
            Drag
          </button>
        </div>
        <label className="block text-sm text-zinc-700">
          <span className="text-xs text-zinc-500">Question</span>
          <input
            type="text"
            name="question"
            defaultValue={item.question}
            required
            className="mt-1 w-full rounded border border-zinc-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm text-zinc-700">
          <span className="text-xs text-zinc-500">Answer (HTML allowed)</span>
          <textarea
            name="answerHtml"
            defaultValue={item.answerHtml}
            required
            rows={5}
            className="mt-1 w-full rounded border border-zinc-200 px-3 py-2 text-sm"
          />
        </label>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2">
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
    </article>
  );
}

export default function FaqAdminList({ items }: Props) {
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
      <p className="text-xs text-zinc-500">Drag and drop FAQs to reorder.</p>
      {isPending ? <p className="text-xs text-zinc-500">Saving order...</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      {list.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-sm">
          No FAQs yet. Add the first one above.
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {list.map((item, index) => (
                <SortableFaqItem key={item.id} item={item} index={index} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
