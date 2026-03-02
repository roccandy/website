"use client";

import { useMemo, useState } from "react";
import type { LabelRange, LabelType, SettingsRow } from "@/lib/data";
import {
  deleteLabelRange,
  updateIngredientLabelSettings,
  updateLabelSettings,
  upsertLabelRange,
} from "./actions";

type Props = {
  ranges: LabelRange[];
  settings: SettingsRow;
  labelTypes: LabelType[];
};

export function LabelsTable({ ranges, settings, labelTypes }: Props) {
  const [editMode, setEditMode] = useState(false);
  const sorted = [...ranges].sort((a, b) => a.upper_bound - b.upper_bound);
  const [shipping, setShipping] = useState(settings.labels_supplier_shipping);
  const [markup, setMarkup] = useState(settings.labels_markup_multiplier);
  const [maxBulk, setMaxBulk] = useState(settings.labels_max_bulk);
  const [ingredientPrice, setIngredientPrice] = useState(Number(settings.ingredient_label_price ?? 0));
  const [ingredientTypeId, setIngredientTypeId] = useState(settings.ingredient_label_type_id ?? "");
  const [dirtyRangeIds, setDirtyRangeIds] = useState<Set<string>>(new Set());
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [ingredientDirty, setIngredientDirty] = useState(false);
  const hasDirty = settingsDirty || ingredientDirty || dirtyRangeIds.size > 0;

  const originalRanges = useMemo(() => {
    const map = new Map<string, LabelRange>();
    ranges.forEach((r) => map.set(r.id, r));
    return map;
  }, [ranges]);

  const originalSettings = useMemo(
    () => ({
      shipping: settings.labels_supplier_shipping,
      markup: settings.labels_markup_multiplier,
      maxBulk: settings.labels_max_bulk,
    }),
    [settings]
  );

  const originalIngredientSettings = useMemo(
    () => ({
      price: Number(settings.ingredient_label_price ?? 0),
      typeId: settings.ingredient_label_type_id ?? "",
    }),
    [settings.ingredient_label_price, settings.ingredient_label_type_id]
  );

  const recomputeSettingsDirty = (next: { shipping?: number; markup?: number; maxBulk?: number }) => {
    const nextShipping = next.shipping ?? shipping;
    const nextMarkup = next.markup ?? markup;
    const nextMaxBulk = next.maxBulk ?? maxBulk;
    setSettingsDirty(
      nextShipping !== originalSettings.shipping ||
        nextMarkup !== originalSettings.markup ||
        nextMaxBulk !== originalSettings.maxBulk
    );
  };

  const recomputeIngredientDirty = (next: { price?: number; typeId?: string }) => {
    const nextPrice = next.price ?? ingredientPrice;
    const nextTypeId = next.typeId ?? ingredientTypeId;
    setIngredientDirty(
      nextPrice !== originalIngredientSettings.price || nextTypeId !== originalIngredientSettings.typeId
    );
  };

  const handleSaveAll = () => {
    if (settingsDirty) {
      const settingsForm = document.querySelector<HTMLFormElement>("#label-settings");
      settingsForm?.requestSubmit();
    }
    if (ingredientDirty) {
      const ingredientSettingsForm = document.querySelector<HTMLFormElement>("#ingredient-label-settings");
      ingredientSettingsForm?.requestSubmit();
    }
    document.querySelectorAll<HTMLFormElement>("form[data-label-form]").forEach((f) => {
      const id = f.dataset.id;
      if (id && dirtyRangeIds.has(id)) {
        f.requestSubmit();
      }
    });
    setDirtyRangeIds(new Set());
    setSettingsDirty(false);
    setIngredientDirty(false);
    try {
      const evt = new CustomEvent("toast", { detail: { message: "Labels saved", tone: "success" } });
      window.dispatchEvent(evt);
    } catch {
      // no-op
    }
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

      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h3 className="text-base font-semibold text-zinc-900">Global label settings</h3>
        <form
          id="label-settings"
          data-label-form
          action={updateLabelSettings}
          className="mt-2 grid gap-4 text-sm text-zinc-700 sm:grid-cols-2 md:grid-cols-3"
        >
          <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.2em] text-zinc-500">
            Supplier shipping
            {editMode ? (
              <input
                type="number"
                step="0.01"
                name="labels_supplier_shipping"
                value={shipping}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setShipping(next);
                  recomputeSettingsDirty({ shipping: next });
                }}
                className="rounded border border-zinc-300 px-2 py-1 text-sm text-zinc-900"
              />
            ) : (
              <span className="text-sm font-semibold text-zinc-900">${shipping.toFixed(2)}</span>
            )}
          </label>

          <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.2em] text-zinc-500">
            Markup multiplier
            {editMode ? (
              <input
                type="number"
                step="0.01"
                name="labels_markup_multiplier"
                value={markup}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setMarkup(next);
                  recomputeSettingsDirty({ markup: next });
                }}
                className="rounded border border-zinc-300 px-2 py-1 text-sm text-zinc-900"
              />
            ) : (
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-zinc-900">{markup.toFixed(2)}x</span>
                <span className="text-xs text-zinc-500">(+{((markup - 1) * 100).toFixed(0)}%)</span>
              </div>
            )}
          </label>

          <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.2em] text-zinc-500">
            Max labels (bulk)
            {editMode ? (
              <input
                type="number"
                step="1"
                min="0"
                name="labels_max_bulk"
                value={maxBulk}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setMaxBulk(next);
                  recomputeSettingsDirty({ maxBulk: next });
                }}
                className="rounded border border-zinc-300 px-2 py-1 text-sm text-zinc-900"
              />
            ) : (
              <span className="text-sm font-semibold text-zinc-900">{maxBulk}</span>
            )}
          </label>
        </form>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h3 className="text-base font-semibold text-zinc-900">Ingredient label settings</h3>
        <form
          id="ingredient-label-settings"
          action={updateIngredientLabelSettings}
          className="mt-2 grid gap-4 text-sm text-zinc-700 sm:grid-cols-2"
        >
          <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.2em] text-zinc-500">
            Ingredient label price
            {editMode ? (
              <input
                type="number"
                step="0.01"
                min="0"
                name="ingredient_label_price"
                value={ingredientPrice}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setIngredientPrice(next);
                  recomputeIngredientDirty({ price: next });
                }}
                className="rounded border border-zinc-300 px-2 py-1 text-sm text-zinc-900"
              />
            ) : (
              <span className="text-sm font-semibold text-zinc-900">${ingredientPrice.toFixed(2)}</span>
            )}
          </label>

          <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.2em] text-zinc-500">
            Ingredient label type
            {editMode ? (
              <select
                name="ingredient_label_type_id"
                value={ingredientTypeId}
                onChange={(e) => {
                  const next = e.target.value;
                  setIngredientTypeId(next);
                  recomputeIngredientDirty({ typeId: next });
                }}
                className="rounded border border-zinc-300 px-2 py-1 text-sm text-zinc-900"
              >
                <option value="">No default selected</option>
                {labelTypes.map((labelType) => (
                  <option key={labelType.id} value={labelType.id}>
                    {labelType.shape} - {labelType.dimensions}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-sm font-semibold text-zinc-900">
                {labelTypes.find((labelType) => labelType.id === ingredientTypeId)
                  ? `${labelTypes.find((labelType) => labelType.id === ingredientTypeId)?.shape} - ${
                      labelTypes.find((labelType) => labelType.id === ingredientTypeId)?.dimensions
                    }`
                  : "No default selected"}
              </span>
            )}
          </label>
        </form>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-500">
              <th className="px-3 py-2">Upper bound</th>
              {editMode && <th className="px-3 py-2 w-28">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {sorted.map((range) => {
              const formId = `range-${range.id}`;
              const recomputeRangeDirty = () => {
                const form = document.getElementById(formId) as HTMLFormElement | null;
                const original = originalRanges.get(range.id);
                if (!form || !original) return;
                const upper = Number(
                  (form.elements.namedItem("upper_bound") as HTMLInputElement | null)?.value ?? 0
                );
                const isSame = Number(original.upper_bound) === upper;
                setDirtyRangeIds((prev) => {
                  const next = new Set(prev);
                  if (isSame) next.delete(range.id);
                  else next.add(range.id);
                  return next;
                });
              };

              return (
                <tr key={range.id} className="border-t border-zinc-100">
                  <td className="px-3 py-2">
                    {editMode ? (
                      <input
                        form={formId}
                        type="number"
                        name="upper_bound"
                        defaultValue={range.upper_bound}
                        className="w-full rounded border border-zinc-200 px-2 py-1"
                        onChange={recomputeRangeDirty}
                        required
                      />
                    ) : (
                      range.upper_bound
                    )}
                  </td>
                  {editMode && (
                    <td className="px-3 py-2 space-y-1">
                      <form
                        id={formId}
                        data-label-form
                        data-id={range.id}
                        data-new="false"
                        action={upsertLabelRange}
                        className="hidden"
                      >
                        <input type="hidden" name="id" value={range.id} />
                        <input type="hidden" name="range_cost" value={range.range_cost} />
                      </form>
                      <form action={deleteLabelRange}>
                        <input type="hidden" name="id" value={range.id} />
                        <button
                          type="submit"
                          className="w-full rounded border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </form>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
