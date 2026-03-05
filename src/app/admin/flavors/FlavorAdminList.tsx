"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Flavor } from "@/lib/data";
import { deleteFlavor, toggleFlavorActive, updateFlavorOrder } from "./actions";

type Props = {
  items: Flavor[];
};

function SortableFlavorItem({ item, index }: { item: Flavor; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const isActive = item.is_active !== false;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between py-2 ${isDragging ? "opacity-80" : ""}`}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-zinc-900">{item.name}</span>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            isActive ? "bg-emerald-100 text-emerald-700" : "bg-zinc-200 text-zinc-600"
          }`}
        >
          {isActive ? "Active" : "Inactive"}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="inline-flex cursor-grab items-center rounded border border-zinc-200 px-2 py-1 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-50 active:cursor-grabbing"
          aria-label={`Drag to reorder flavor ${index + 1}`}
          {...attributes}
          {...listeners}
        >
          Drag
        </button>
        <form action={toggleFlavorActive}>
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="next_active" value={isActive ? "false" : "true"} />
          <button
            type="submit"
            data-neutral-button
            className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold text-zinc-700 hover:text-zinc-900"
          >
            {isActive ? "Deactivate" : "Activate"}
          </button>
        </form>
        <form action={deleteFlavor}>
          <input type="hidden" name="id" value={item.id} />
          <button
            type="submit"
            data-neutral-button
            className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold text-red-600 hover:text-red-700"
          >
            Delete
          </button>
        </form>
      </div>
    </div>
  );
}

export default function FlavorAdminList({ items }: Props) {
  const router = useRouter();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [list, setList] = useState<Flavor[]>(items);
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
    const next = arrayMove(list, oldIndex, newIndex).map((item, index) => ({ ...item, sort_order: index }));
    setList(next);
    setError(null);

    startTransition(async () => {
      const result = await updateFlavorOrder(next.map((item, index) => ({ id: item.id, sortOrder: index })));
      if (result.error) {
        setList(previous);
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  };

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs text-zinc-500">Drag and drop flavors to reorder.</p>
      {isPending ? <p className="text-xs text-zinc-500">Saving order...</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      {list.length === 0 ? (
        <p className="text-sm text-zinc-500">No flavors yet.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <div className="divide-y divide-zinc-100">
              {list.map((item, index) => (
                <SortableFlavorItem key={item.id} item={item} index={index} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
