"use client";

import { Fragment, useMemo, useState } from "react";
import type { Category, LabelType, PackagingOption } from "@/lib/data";
import { sortPackagingOptions, sortPackagingTypes } from "@/lib/packaging";
import {
  deletePackaging,
  togglePackagingActive,
  updatePackagingTypeOrder,
  upsertPackaging,
} from "./actions";

const DEFAULT_LID_COLORS = ["black", "silver", "gold"];

function formatLabelType(type: LabelType) {
  const shape = type.shape.charAt(0).toUpperCase() + type.shape.slice(1);
  return type.dimensions?.trim() ? `${shape} ${type.dimensions.trim()}` : shape;
}

function moveItem(items: string[], index: number, direction: -1 | 1) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= items.length) return items;
  const next = [...items];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  return next;
}

type OptionFormProps = {
  option?: PackagingOption;
  packageType: string;
  typeSortOrder: number;
  categories: Category[];
  labelTypes: LabelType[];
  knownLidColors: string[];
  allowTypeEdit?: boolean;
  onCancel: () => void;
};

function PackagingOptionForm({
  option,
  packageType,
  typeSortOrder,
  categories,
  labelTypes,
  knownLidColors,
  allowTypeEdit = false,
  onCancel,
}: OptionFormProps) {
  const [typeValue, setTypeValue] = useState(packageType);
  const [selectedLids, setSelectedLids] = useState<string[]>(option?.lid_colors ?? []);
  const [customLid, setCustomLid] = useState("");
  const isJar = typeValue.toLowerCase().includes("jar");
  const lidChoices = Array.from(new Set([...knownLidColors, ...selectedLids])).sort((a, b) => a.localeCompare(b));

  const addCustomLid = () => {
    const value = customLid.trim().toLowerCase();
    if (!value) return;
    setSelectedLids((current) => (current.includes(value) ? current : [...current, value]));
    setCustomLid("");
  };

  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-4">
      <form action={upsertPackaging} className="space-y-4">
        {option ? <input type="hidden" name="id" value={option.id} /> : null}
        <input type="hidden" name="type_sort_order" value={typeSortOrder} />
        <input type="hidden" name="is_active" value={option?.is_active === false ? "false" : "true"} />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Package type
            {allowTypeEdit || option ? (
              <input
                name="type"
                required
                value={typeValue}
                onChange={(event) => {
                  setTypeValue(event.target.value);
                  if (!event.target.value.toLowerCase().includes("jar")) setSelectedLids([]);
                }}
                className="mt-2 min-h-10 w-full rounded border border-zinc-200 bg-white px-3 py-2 text-sm normal-case tracking-normal text-zinc-900"
              />
            ) : (
              <>
                <input type="hidden" name="type" value={typeValue} />
                <span className="mt-2 flex min-h-10 items-center rounded border border-zinc-200 bg-zinc-100 px-3 py-2 text-sm normal-case tracking-normal text-zinc-700">
                  {typeValue}
                </span>
              </>
            )}
          </label>
          <label className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Size / name
            <input
              name="size"
              required
              defaultValue={option?.size ?? ""}
              placeholder="e.g. 100g"
              className="mt-2 min-h-10 w-full rounded border border-zinc-200 bg-white px-3 py-2 text-sm normal-case tracking-normal text-zinc-900"
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Dimensions
            <input
              name="dimensions"
              defaultValue={option?.dimensions ?? ""}
              placeholder="e.g. 90 × 140mm"
              className="mt-2 min-h-10 w-full rounded border border-zinc-200 bg-white px-3 py-2 text-sm normal-case tracking-normal text-zinc-900"
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Candy weight (g)
            <input
              type="number"
              min="0.1"
              step="0.1"
              name="candy_weight_g"
              required
              defaultValue={option?.candy_weight_g ?? ""}
              className="mt-2 min-h-10 w-full rounded border border-zinc-200 bg-white px-3 py-2 text-sm normal-case tracking-normal text-zinc-900"
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Unit price
            <input
              type="number"
              min="0"
              step="0.01"
              name="unit_price"
              required
              defaultValue={option?.unit_price ?? ""}
              className="mt-2 min-h-10 w-full rounded border border-zinc-200 bg-white px-3 py-2 text-sm normal-case tracking-normal text-zinc-900"
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Maximum packages
            <input
              type="number"
              min="1"
              step="1"
              name="max_packages"
              required
              defaultValue={option?.max_packages ?? ""}
              className="mt-2 min-h-10 w-full rounded border border-zinc-200 bg-white px-3 py-2 text-sm normal-case tracking-normal text-zinc-900"
            />
          </label>
        </div>

        <fieldset>
          <legend className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Allowed order types</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {categories.map((category) => (
              <label key={category.id} className="inline-flex items-center gap-2 rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-700">
                <input
                  type="checkbox"
                  name="allowed_category"
                  value={category.id}
                  defaultChecked={option?.allowed_categories.includes(category.id) ?? false}
                />
                {category.name}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Allowed labels</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {labelTypes.map((labelType) => (
              <label key={labelType.id} className="inline-flex items-center gap-2 rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-700">
                <input
                  type="checkbox"
                  name="label_type_id"
                  value={labelType.id}
                  defaultChecked={option?.label_type_ids?.includes(labelType.id) ?? false}
                />
                {formatLabelType(labelType)}
              </label>
            ))}
            {labelTypes.length === 0 ? <span className="text-xs text-zinc-500">No label types configured.</span> : null}
          </div>
        </fieldset>

        {isJar ? (
          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Jar lid colours</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {lidChoices.map((color) => (
                <label key={color} className="inline-flex items-center gap-2 rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs capitalize text-zinc-700">
                  <input
                    type="checkbox"
                    name="lid_color"
                    value={color}
                    checked={selectedLids.includes(color)}
                    onChange={() =>
                      setSelectedLids((current) =>
                        current.includes(color) ? current.filter((item) => item !== color) : [...current, color],
                      )
                    }
                  />
                  {color}
                </label>
              ))}
            </div>
            <div className="mt-3 flex max-w-md gap-2">
              <input
                value={customLid}
                onChange={(event) => setCustomLid(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addCustomLid();
                  }
                }}
                placeholder="New lid colour"
                className="min-h-10 min-w-0 flex-1 rounded border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
              />
              <button type="button" onClick={addCustomLid} className="rounded border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700">
                Add colour
              </button>
            </div>
          </fieldset>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" className="rounded bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800">
            {option ? "Save changes" : "Create option"}
          </button>
          <button type="button" onClick={onCancel} className="rounded border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-zinc-700">
            Cancel
          </button>
        </div>
      </form>
      {option ? (
        <form
          action={deletePackaging}
          className="mt-3 border-t border-rose-100 pt-3"
          onSubmit={(event) => {
            if (!window.confirm(`Delete ${option.type} ${option.size} permanently?`)) event.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={option.id} />
          <button type="submit" className="text-xs font-semibold text-rose-700 hover:underline">Delete packaging option</button>
        </form>
      ) : null}
    </div>
  );
}

type Props = {
  options: PackagingOption[];
  categories: Category[];
  labelTypes: LabelType[];
};

export function PackagingOptionsManager({ options, categories, labelTypes }: Props) {
  const initialTypes = useMemo(
    () => sortPackagingTypes(Array.from(new Set(options.map((option) => option.type).filter(Boolean))), options),
    [options],
  );
  const [orderedTypes, setOrderedTypes] = useState(initialTypes);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingType, setAddingType] = useState<string | null>(null);
  const [addingCustomType, setAddingCustomType] = useState(false);
  const knownLidColors = useMemo(
    () =>
      Array.from(new Set([...DEFAULT_LID_COLORS, ...options.flatMap((option) => option.lid_colors ?? [])])).sort((a, b) =>
        a.localeCompare(b),
      ),
    [options],
  );
  const sortedOptions = useMemo(() => sortPackagingOptions(options), [options]);
  const typeOrderChanged = orderedTypes.join("|") !== initialTypes.join("|");

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Website order</p>
            <h3 className="admin-subsection-title text-zinc-900">Packaging types</h3>
          </div>
          <form action={updatePackagingTypeOrder}>
            <input type="hidden" name="ordered_types" value={JSON.stringify(orderedTypes)} />
            <button
              type="submit"
              disabled={!typeOrderChanged}
              className="rounded bg-zinc-900 px-3 py-2 text-xs font-semibold text-white disabled:bg-zinc-100 disabled:text-zinc-400"
            >
              Save type order
            </button>
          </form>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {orderedTypes.map((type, index) => (
            <div key={type} className="inline-flex items-center rounded-lg border border-zinc-200 bg-zinc-50">
              <span className="px-3 py-2 text-xs font-semibold text-zinc-800">{index + 1}. {type}</span>
              <button type="button" disabled={index === 0} onClick={() => setOrderedTypes((current) => moveItem(current, index, -1))} className="border-l border-zinc-200 px-2 py-2 text-xs disabled:text-zinc-300" aria-label={`Move ${type} earlier`}>↑</button>
              <button type="button" disabled={index === orderedTypes.length - 1} onClick={() => setOrderedTypes((current) => moveItem(current, index, 1))} className="border-l border-zinc-200 px-2 py-2 text-xs disabled:text-zinc-300" aria-label={`Move ${type} later`}>↓</button>
            </div>
          ))}
        </div>
      </section>

      {orderedTypes.map((type, typeIndex) => {
        const typeOptions = sortedOptions.filter((option) => option.type === type);
        return (
          <section key={type} className="rounded-xl border border-zinc-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
              <div>
                <h3 className="admin-subsection-title text-zinc-900">{type}</h3>
                <p className="text-xs text-zinc-500">{typeOptions.length} option{typeOptions.length === 1 ? "" : "s"}</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-zinc-50 text-left text-xs text-zinc-500">
                  <tr>
                    <th className="px-3 py-2">Size</th>
                    <th className="px-3 py-2">Weight</th>
                    <th className="px-3 py-2">Categories</th>
                    <th className="px-3 py-2">Labels</th>
                    <th className="px-3 py-2">Lids</th>
                    <th className="px-3 py-2">Price</th>
                    <th className="px-3 py-2">Max</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {typeOptions.map((option) => {
                    const isActive = option.is_active !== false;
                    return (
                      <Fragment key={option.id}>
                        <tr className={`border-t border-zinc-100 ${isActive ? "" : "bg-zinc-50 text-zinc-500"}`}>
                          <td className="px-3 py-2"><span className="font-semibold text-zinc-900">{option.size}</span>{option.dimensions ? <span className="block text-xs text-zinc-400">{option.dimensions}</span> : null}</td>
                          <td className="px-3 py-2">{option.candy_weight_g}g</td>
                          <td className="max-w-56 px-3 py-2 text-xs">{option.allowed_categories.map((id) => categories.find((category) => category.id === id)?.name ?? id).join(", ") || "-"}</td>
                          <td className="max-w-48 px-3 py-2 text-xs">{(option.label_type_ids ?? []).map((id) => { const label = labelTypes.find((item) => item.id === id); return label ? formatLabelType(label) : id; }).join(", ") || "-"}</td>
                          <td className="px-3 py-2 text-xs capitalize">{(option.lid_colors ?? []).join(", ") || "-"}</td>
                          <td className="px-3 py-2">${Number(option.unit_price).toFixed(2)}</td>
                          <td className="px-3 py-2">{option.max_packages}</td>
                          <td className="px-3 py-2"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${isActive ? "bg-emerald-50 text-emerald-700" : "bg-zinc-200 text-zinc-600"}`}>{isActive ? "Enabled" : "Disabled"}</span></td>
                          <td className="px-3 py-2">
                            <div className="flex justify-end gap-2">
                              <button type="button" onClick={() => setEditingId((current) => current === option.id ? null : option.id)} className="rounded border border-zinc-300 px-2 py-1 text-xs font-semibold text-zinc-700">{editingId === option.id ? "Close" : "Edit"}</button>
                              <form action={togglePackagingActive}>
                                <input type="hidden" name="id" value={option.id} />
                                <input type="hidden" name="next_active" value={isActive ? "false" : "true"} />
                                <button type="submit" className={`rounded border px-2 py-1 text-xs font-semibold ${isActive ? "border-amber-200 text-amber-700" : "border-emerald-200 text-emerald-700"}`}>{isActive ? "Disable" : "Enable"}</button>
                              </form>
                            </div>
                          </td>
                        </tr>
                        {editingId === option.id ? (
                          <tr className="border-t border-zinc-100">
                            <td colSpan={9} className="p-3">
                              <PackagingOptionForm option={option} packageType={type} typeSortOrder={typeIndex} categories={categories} labelTypes={labelTypes} knownLidColors={knownLidColors} onCancel={() => setEditingId(null)} />
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                  <tr className="border-t border-zinc-100 bg-zinc-50/60">
                    <td colSpan={9} className="p-2">
                      {addingType === type ? (
                        <PackagingOptionForm packageType={type} typeSortOrder={typeIndex} categories={categories} labelTypes={labelTypes} knownLidColors={knownLidColors} onCancel={() => setAddingType(null)} />
                      ) : (
                        <button type="button" onClick={() => { setAddingType(type); setAddingCustomType(false); }} className="w-full rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-left text-xs font-semibold text-zinc-600 hover:border-zinc-500 hover:bg-white">+ Add new {type} option</button>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      <section className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-3">
        {addingCustomType ? (
          <PackagingOptionForm packageType="" typeSortOrder={orderedTypes.length} categories={categories} labelTypes={labelTypes} knownLidColors={knownLidColors} allowTypeEdit onCancel={() => setAddingCustomType(false)} />
        ) : (
          <button type="button" onClick={() => { setAddingCustomType(true); setAddingType(null); }} className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-zinc-700">+ Add a custom packaging type</button>
        )}
      </section>
    </div>
  );
}
