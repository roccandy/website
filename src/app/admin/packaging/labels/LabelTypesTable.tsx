"use client";

import { AdminSubmitButton } from "@/components/AdminSubmitButton";
import { useMemo, useState } from "react";
import type { LabelType } from "@/lib/data";
import { deleteLabelType, upsertLabelType } from "./actions";

type Props = {
  labelTypes: LabelType[];
};

const LABEL_SHAPES: Array<{ value: LabelType["shape"]; label: string }> = [
  { value: "square", label: "Square" },
  { value: "rectangular", label: "Rectangular" },
  { value: "circle", label: "Circle" },
];

function formatLabelType(type: Pick<LabelType, "shape" | "dimensions">) {
  const shapeLabel = LABEL_SHAPES.find((shape) => shape.value === type.shape)?.label ?? type.shape;
  const dimension = (type.dimensions || "").trim();
  return dimension ? `${shapeLabel} ${dimension}` : shapeLabel;
}

function formatLabelShape(shape: LabelType["shape"]) {
  return LABEL_SHAPES.find((item) => item.value === shape)?.label ?? shape;
}

export function LabelTypesTable({ labelTypes }: Props) {
  const [editMode, setEditMode] = useState(false);
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [newDirty, setNewDirty] = useState(false);
  const sorted = useMemo(
    () =>
      [...labelTypes].sort((a, b) => {
        const aLabel = formatLabelType(a).toLowerCase();
        const bLabel = formatLabelType(b).toLowerCase();
        return aLabel.localeCompare(bLabel);
      }),
    [labelTypes]
  );
  const originalMap = useMemo(() => {
    const map = new Map<string, LabelType>();
    labelTypes.forEach((labelType) => map.set(labelType.id, labelType));
    return map;
  }, [labelTypes]);
  const hasDirty = newDirty || dirtyIds.size > 0;

  const handleSaveAll = () => {
    document.querySelectorAll<HTMLFormElement>("form[data-label-type-form]").forEach((form) => {
      const id = form.dataset.id;
      const isNew = form.dataset.new === "true";
      if (isNew ? newDirty : id && dirtyIds.has(id)) {
        form.requestSubmit();
      }
    });
    setDirtyIds(new Set());
    setNewDirty(false);
    try {
      const evt = new CustomEvent("toast", { detail: { message: "Label types saved", tone: "success" } });
      window.dispatchEvent(evt);
    } catch {
      // no-op
    }
  };

  const recomputeDirty = (id: string) => {
    const form = document.getElementById(`label-type-${id}`) as HTMLFormElement | null;
    const original = originalMap.get(id);
    if (!form || !original) return;
    const shape = (form.elements.namedItem("shape") as HTMLSelectElement | null)?.value ?? "";
    const dimensions = (form.elements.namedItem("dimensions") as HTMLInputElement | null)?.value ?? "";
    const cost = Number((form.elements.namedItem("cost") as HTMLInputElement | null)?.value ?? 0);
    const isSame =
      original.shape === shape &&
      (original.dimensions || "") === dimensions &&
      Number(original.cost) === cost;
    setDirtyIds((prev) => {
      const next = new Set(prev);
      if (isSame) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <>
      <div className="flex gap-2">
        {!editMode && (
          <button
            type="button"
            onClick={() => setEditMode(true)}
            className="inline-flex items-center rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800"
          >
            Edit
          </button>
        )}
        {editMode && (
          <>
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={!hasDirty}
              className={`inline-flex items-center rounded-md px-3 py-1.5 text-xs font-semibold ${
                hasDirty ? "bg-zinc-900 text-white hover:bg-zinc-800" : "bg-zinc-100 text-zinc-500"
              }`}
            >
              Save all
            </button>
            <button
              type="button"
              onClick={() => setEditMode(false)}
              className="inline-flex items-center rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:border-zinc-400"
            >
              Done (view only)
            </button>
          </>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-500">
              <th className="px-3 py-2">Label type</th>
              <th className="px-3 py-2">Dimensions</th>
              <th className="px-3 py-2">Label cost</th>
              {editMode && <th className="px-3 py-2 w-28">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {sorted.map((labelType) => {
              const formId = `label-type-${labelType.id}`;
              return (
                <tr key={labelType.id} className="border-t border-zinc-100">
                  <td className="px-3 py-2">
                    {editMode ? (
                      <select
                        form={formId}
                        name="shape"
                        defaultValue={labelType.shape}
                        className="w-full rounded border border-zinc-200 px-2 py-1"
                        onChange={() => recomputeDirty(labelType.id)}
                      >
                        {LABEL_SHAPES.map((shape) => (
                          <option key={shape.value} value={shape.value}>
                            {shape.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      formatLabelShape(labelType.shape)
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editMode ? (
                      <input
                        form={formId}
                        type="text"
                        name="dimensions"
                        defaultValue={labelType.dimensions}
                        className="w-full rounded border border-zinc-200 px-2 py-1"
                        onChange={() => recomputeDirty(labelType.id)}
                        placeholder="e.g. 45x20mm"
                      />
                    ) : (
                      labelType.dimensions
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editMode ? (
                      <input
                        form={formId}
                        type="number"
                        step="0.01"
                        name="cost"
                        defaultValue={labelType.cost}
                        className="w-full rounded border border-zinc-200 px-2 py-1"
                        onChange={() => recomputeDirty(labelType.id)}
                      />
                    ) : (
                      <>${Number(labelType.cost).toFixed(2)}</>
                    )}
                  </td>
                  {editMode && (
                    <td className="px-3 py-2 space-y-1">
                      <form
                        id={formId}
                        data-label-type-form
                        data-id={labelType.id}
                        data-new="false"
                        action={upsertLabelType}
                        className="hidden"
                      >
                        <input type="hidden" name="id" value={labelType.id} />
                      </form>
                      <form action={deleteLabelType}>
                        <input type="hidden" name="id" value={labelType.id} />
                        <AdminSubmitButton
                          type="submit"
                          className="w-full rounded border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                        >
                          Delete
                        </AdminSubmitButton>
                      </form>
                    </td>
                  )}
                </tr>
              );
            })}
            {editMode && (
              <tr className="border-t border-zinc-100 bg-zinc-50/60">
                <td className="px-3 py-2">
                  <select
                    form="label-type-new"
                    name="shape"
                    className="w-full rounded border border-zinc-200 px-2 py-1"
                    onChange={() => setNewDirty(true)}
                  >
                    {LABEL_SHAPES.map((shape) => (
                      <option key={shape.value} value={shape.value}>
                        {shape.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input
                    form="label-type-new"
                    type="text"
                    name="dimensions"
                    className="w-full rounded border border-zinc-200 px-2 py-1"
                    placeholder="e.g. 45x20mm"
                    onChange={() => setNewDirty(true)}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    form="label-type-new"
                    type="number"
                    step="0.01"
                    name="cost"
                    className="w-full rounded border border-zinc-200 px-2 py-1"
                    placeholder="0.00"
                    onChange={() => setNewDirty(true)}
                  />
                </td>
                <td className="px-3 py-2">
                  <form
                    id="label-type-new"
                    data-label-type-form
                    data-id="new"
                    data-new="true"
                    action={upsertLabelType}
                    className="hidden"
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
