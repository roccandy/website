"use client";

import { useEffect, useMemo, useState } from "react";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { PremadeCandy } from "@/lib/data";
import { EditPremadeItem } from "./EditPremadeItem";
import { setPremadeActive, updatePremadeOrder } from "./actions";

type PremadeAdminItem = PremadeCandy & { imageUrl: string };

type Props = {
  items: PremadeAdminItem[];
  flavorOptions: string[];
};

function SortablePremadeItem({
  item,
  flavorOptions,
  onToggleActive,
  onDelete,
}: {
  item: PremadeAdminItem;
  flavorOptions: string[];
  onToggleActive: (id: string, nextActive: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "opacity-80" : ""}>
      <EditPremadeItem
        item={item}
        imageUrl={item.imageUrl}
        flavorOptions={flavorOptions}
        onToggleActive={onToggleActive}
        onDelete={onDelete}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

export function PremadeList({ items, flavorOptions }: Props) {
  const [list, setList] = useState<PremadeAdminItem[]>(items);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    setList(items);
  }, [items]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleToggleActive = async (id: string, nextActive: boolean) => {
    setActionError(null);
    setList((prev) => prev.map((item) => (item.id === id ? { ...item, is_active: nextActive } : item)));
    const { error } = await setPremadeActive(id, nextActive);
    if (error) {
      setActionError(error);
      setList((prev) => prev.map((item) => (item.id === id ? { ...item, is_active: !nextActive } : item)));
    }
  };

  const handleDelete = (id: string) => {
    setActionError(null);
    setList((prev) => prev.filter((item) => item.id !== id));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;
    const oldIndex = list.findIndex((item) => item.id === activeId);
    const newIndex = list.findIndex((item) => item.id === overId);
    if (oldIndex === -1 || newIndex === -1) return;
    const next = arrayMove(list, oldIndex, newIndex).map((item, index) => ({
      ...item,
      sort_order: index,
    }));
    setList(next);
    const { error } = await updatePremadeOrder(next.map((item) => ({ id: item.id, sort_order: item.sort_order ?? 0 })));
    if (error) {
      setActionError(error);
    }
  };

  const ids = useMemo(() => list.map((item) => item.id), [list]);

  return (
    <div className="space-y-3">
      {actionError ? <p className="text-xs text-red-600">{actionError}</p> : null}
      {isClient ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {list.map((item) => (
                <SortablePremadeItem
                  key={item.id}
                  item={item}
                  flavorOptions={flavorOptions}
                  onToggleActive={handleToggleActive}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="space-y-3">
          {list.map((item) => (
            <EditPremadeItem
              key={item.id}
              item={item}
              imageUrl={item.imageUrl}
              flavorOptions={flavorOptions}
              onToggleActive={handleToggleActive}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
