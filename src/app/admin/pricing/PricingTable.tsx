"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { deleteTier, upsertTier } from "./actions";
import type { Category, WeightTier } from "@/lib/data";

type Props = { categories: Category[]; tiers: WeightTier[]; maxTotalKg: number };
type DraftTier = WeightTier & { isNew?: boolean };

const START_KG = 0;

export function PricingTable({ categories, tiers, maxTotalKg }: Props) {
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<DraftTier[]>(tiers);
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const originalMap = useMemo(() => new Map(tiers.map((t) => [t.id, t])), [tiers]);
  useEffect(() => {
    // Reset draft when server data changes.
    setDraft(tiers);
    setDirtyIds(new Set());
  }, [tiers]);

  const isTierDirty = useCallback(
    (t: DraftTier) => {
      const orig = originalMap.get(t.id);
      if (!orig) return true;
      const same =
        Number(orig.min_kg) === Number(t.min_kg) &&
        Number(orig.max_kg) === Number(t.max_kg) &&
        Number(orig.price) === Number(t.price) &&
        Boolean(orig.per_kg) === Boolean(t.per_kg) &&
        (orig.notes ?? "") === (t.notes ?? "");
      return !same;
    },
    [originalMap]
  );

  useEffect(() => {
    const next = new Set<string>();
    draft.forEach((t) => {
      if (isTierDirty(t)) next.add(t.id);
    });
    setDirtyIds(next);
  }, [draft, isTierDirty]);

  const hasDirty = dirtyIds.size > 0;

  const formatMoney = (n: number) => {
    const rounded = Number(n.toFixed(2));
    return `$${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(2)}`;
  };

  const ordered = useMemo(
    () =>
      [...draft].sort((a, b) => {
        if (a.category_id === b.category_id) return Number(a.min_kg) - Number(b.min_kg);
        return (
          categories.findIndex((c) => c.id === a.category_id) -
          categories.findIndex((c) => c.id === b.category_id)
        );
      }),
    [categories, draft]
  );

  const lastTierIdByCategory = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((cat) => {
      const catTiers = ordered
        .filter((t) => t.category_id === cat.id)
        .sort((a, b) => Number(a.min_kg) - Number(b.min_kg) || Number(a.max_kg) - Number(b.max_kg));
      const last = catTiers[catTiers.length - 1];
      if (last) map.set(cat.id, last.id);
    });
    return map;
  }, [categories, ordered]);

  const validation = useMemo(() => {
    return categories.map((cat) => {
      const lastTierId = lastTierIdByCategory.get(cat.id);
      const catTiers = ordered
        .filter((t) => t.category_id === cat.id)
        .map((t) => ({
          min: Number(t.min_kg),
          max:
            lastTierId === t.id && Number.isFinite(maxTotalKg) && maxTotalKg > 0
              ? maxTotalKg
              : Number(t.max_kg),
        }))
        .sort((a, b) => a.min - b.min || a.max - b.max);

      if (catTiers.length === 0) return { category: cat, ok: false, message: "No tiers defined." };

      let cursor = START_KG;
      for (const t of catTiers) {
        if (t.min > cursor) return { category: cat, ok: false, message: `Gap at ${cursor}kg.` };
        if (t.min < cursor) return { category: cat, ok: false, message: `Overlap at ${t.min}kg.` };
        if (t.max < t.min) return { category: cat, ok: false, message: "Max below min." };
        cursor = t.max;
      }
      if (cursor < maxTotalKg) return { category: cat, ok: false, message: `Missing coverage to ${maxTotalKg}kg.` };
      return { category: cat, ok: true, message: `Coverage 0-${maxTotalKg} kg OK.` };
    });
  }, [categories, lastTierIdByCategory, ordered, maxTotalKg]);

  const setTierValue = (id: string, updates: Partial<DraftTier>) => {
    setDraft((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const nextMin = updates.min_kg !== undefined ? Math.min(maxTotalKg, updates.min_kg) : t.min_kg;
        const nextMax = updates.max_kg !== undefined ? Math.min(maxTotalKg, updates.max_kg) : t.max_kg;
        return { ...t, ...updates, min_kg: nextMin, max_kg: nextMax };
      })
    );
  };

  const addSegment = (catId: string) => {
    if (!Number.isFinite(maxTotalKg) || maxTotalKg <= START_KG) return;
    const catTiers = ordered
      .filter((t) => t.category_id === catId)
      .sort((a, b) => Number(a.min_kg) - Number(b.min_kg) || Number(a.max_kg) - Number(b.max_kg));
    const lastTier = catTiers[catTiers.length - 1];

    if (!lastTier) {
      const newId = crypto.randomUUID();
      setDraft((prev) => [
        ...prev,
        {
          id: newId,
          category_id: catId,
          min_kg: START_KG,
          max_kg: Math.min(maxTotalKg, START_KG + 1),
          price: 0,
          per_kg: false,
          notes: "",
          isNew: true,
        },
      ]);
      setEditMode(true);
      return;
    }

    const isLastSavedTier = lastTierIdByCategory.get(catId) === lastTier.id;
    const resolvedLastMax = isLastSavedTier ? maxTotalKg : Number(lastTier.max_kg);

    // Normal append when the current tiers do not yet reach the configured max.
    if (resolvedLastMax < maxTotalKg) {
      const start = Math.min(maxTotalKg, resolvedLastMax);
      const end = Math.min(maxTotalKg, start + 1);
      const newId = crypto.randomUUID();
      setDraft((prev) => [
        ...prev,
        {
          id: newId,
          category_id: catId,
          min_kg: start,
          max_kg: end,
          price: 0,
          per_kg: false,
          notes: "",
          isNew: true,
        },
      ]);
      setEditMode(true);
      return;
    }

    // If already at max coverage, split the current last tier into two ranges.
    const lastMin = Number(lastTier.min_kg);
    const span = resolvedLastMax - lastMin;
    if (span <= 0) return;

    let splitPoint = Number((lastMin + span / 2).toFixed(2));
    if (splitPoint <= lastMin) splitPoint = Number((lastMin + 0.1).toFixed(2));
    if (splitPoint >= resolvedLastMax) splitPoint = Number((resolvedLastMax - 0.1).toFixed(2));
    if (splitPoint <= lastMin || splitPoint >= resolvedLastMax) return;

    const newId = crypto.randomUUID();
    setDraft((prev) =>
      prev
        .map((tier) => (tier.id === lastTier.id ? { ...tier, max_kg: splitPoint } : tier))
        .concat({
          id: newId,
          category_id: catId,
          min_kg: splitPoint,
          max_kg: resolvedLastMax,
          price: Number(lastTier.price),
          per_kg: Boolean(lastTier.per_kg),
          notes: lastTier.notes ?? "",
          isNew: true,
        })
    );
    setEditMode(true);
  };

  const handleSaveAll = () => {
    if (!hasDirty) return;
    document.querySelectorAll<HTMLFormElement>("form[data-tier-form]").forEach((f) => {
      const id = f.dataset.id;
      if (id && dirtyIds.has(id)) {
        f.requestSubmit();
      }
    });
    // Inform the user
    const evt = new CustomEvent("toast", {
      detail: { message: "Pricing saved", tone: "success" },
    });
    window.dispatchEvent(evt);
  };

  return (
    <>
      <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Admin</p>
          <p className="text-sm font-semibold text-zinc-900">Weight-based pricing</p>
        </div>
        {!editMode && (
          <button
            type="button"
            onClick={() => setEditMode(true)}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-zinc-800"
          >
            Edit
          </button>
        )}
        {editMode && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={!hasDirty}
              className={`rounded-lg px-4 py-2 text-xs font-semibold shadow-sm ${
                hasDirty
                  ? "border border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800"
                  : "border border-zinc-200 bg-zinc-100 text-zinc-500"
              }`}
            >
              Save all
            </button>
            <button
              type="button"
              onClick={() => setEditMode(false)}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-xs font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50"
            >
              Done (view only)
            </button>
          </div>
        )}
      </div>

      <div className="space-y-6">
        {categories.map((cat) => {
          const catTiers = ordered.filter((t) => t.category_id === cat.id);
          const lastTierId = lastTierIdByCategory.get(cat.id);
          const status = validation.find((v) => v.category.id === cat.id);

          return (
            <div
              key={cat.id}
              className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-6 shadow-md transition hover:shadow-lg"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Category</p>
                  <h3 className="text-xl font-semibold text-zinc-900">{cat.name}</h3>
                  <p className="text-xs text-zinc-500">Ranges must cover 0-{maxTotalKg} kg contiguously.</p>
                </div>
                {status && (
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      status.ok
                        ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border border-amber-200 bg-amber-50 text-amber-800"
                    }`}
                  >
                    {status.message}
                  </span>
                )}
              </div>

              <div className="overflow-hidden rounded-2xl border border-zinc-200">
                {!editMode ? (
                  <table className="min-w-full text-sm">
                    <thead className="bg-zinc-50 text-[11px] uppercase tracking-[0.2em] text-zinc-500">
                      <tr>
                        <th className="px-4 py-3 text-left">Weight range</th>
                        <th className="px-4 py-3 text-left">Price</th>
                        <th className="px-4 py-3 text-left">Price range</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {catTiers.map((t, idx) => {
                        const isLastTier = lastTierId === t.id && Number.isFinite(maxTotalKg) && maxTotalKg > 0;
                        const resolvedMax = isLastTier ? maxTotalKg : t.max_kg;
                        const priorFlat = catTiers
                          .slice(0, idx)
                          .filter((tier) => !tier.per_kg)
                          .sort((a, b) => Number(b.max_kg) - Number(a.max_kg))[0];
                        const baseFlat = priorFlat ? Number(priorFlat.price) : 0;
                        const centsPerGram = t.per_kg ? t.price / 10 : null; // $/kg -> cents/gram
                        const cpgLabel =
                          centsPerGram !== null
                            ? ` (${(centsPerGram % 1 === 0 ? centsPerGram.toFixed(0) : centsPerGram.toFixed(2))}c/g)`
                            : "";
                        const priceLabel = `${formatMoney(Number(t.price))} ${t.per_kg ? "Per kg" : "Flat"}${cpgLabel}`;
                        let rangeLabel = priceLabel;
                        if (t.per_kg) {
                          const span = Math.max(0, Number(resolvedMax) - Number(t.min_kg));
                          const minPrice = baseFlat;
                          const maxPrice = baseFlat + Number(t.price) * span;
                          rangeLabel = `${formatMoney(minPrice)} - ${formatMoney(maxPrice)}`;
                        } else {
                          rangeLabel = formatMoney(Number(t.price));
                        }

                        return (
                          <tr key={t.id} className="bg-white hover:bg-zinc-50/70">
                            <td className="px-4 py-3 font-semibold text-zinc-800">
                              {t.min_kg}-{resolvedMax} kg
                            </td>
                            <td className="px-4 py-3 font-semibold text-zinc-900">{priceLabel}</td>
                            <td className="px-4 py-3 text-zinc-800">{rangeLabel}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <table className="min-w-full text-sm">
                    <thead className="bg-zinc-50 text-[11px] uppercase tracking-[0.2em] text-zinc-500">
                      <tr>
                        <th className="px-4 py-3 text-left">Min kg</th>
                        <th className="px-4 py-3 text-left">Max kg</th>
                        <th className="px-4 py-3 text-left">Mode</th>
                        <th className="px-4 py-3 text-left">Price</th>
                        <th className="px-4 py-3 text-right">Delete</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {catTiers.map((t) => {
                        const isLastTier = lastTierId === t.id && Number.isFinite(maxTotalKg) && maxTotalKg > 0;
                        const resolvedMax = isLastTier ? maxTotalKg : t.max_kg;
                        return (
                        <tr key={t.id} className="bg-white hover:bg-zinc-50/70">
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min={START_KG}
                              max={maxTotalKg}
                              value={t.min_kg}
                              onChange={(e) => setTierValue(t.id, { min_kg: Number(e.target.value) })}
                              className="w-20 rounded border border-zinc-300 px-2 py-1 text-sm"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min={START_KG}
                              max={maxTotalKg}
                              value={resolvedMax}
                              onChange={(e) => setTierValue(t.id, { max_kg: Number(e.target.value) })}
                              disabled={isLastTier}
                              className="w-20 rounded border border-zinc-300 px-2 py-1 text-sm"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="inline-flex overflow-hidden rounded-full border border-zinc-300">
                              <button
                                type="button"
                                onClick={() => setTierValue(t.id, { per_kg: false })}
                                className={`px-3 py-1 text-xs font-semibold ${
                                  t.per_kg ? "bg-white text-zinc-700" : "bg-zinc-900 text-white"
                                }`}
                              >
                                Flat
                              </button>
                              <button
                                type="button"
                                onClick={() => setTierValue(t.id, { per_kg: true })}
                                className={`px-3 py-1 text-xs font-semibold ${
                                  t.per_kg ? "bg-zinc-900 text-white" : "bg-white text-zinc-700"
                                }`}
                              >
                                Per kg
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              step="0.01"
                              value={t.price}
                              onChange={(e) => setTierValue(t.id, { price: Number(e.target.value) })}
                              className="w-28 rounded border border-zinc-300 px-2 py-1 text-sm"
                            />
                          </td>
                          <td className="px-4 py-3 text-right">
                            {!t.isNew && (
                              <form action={deleteTier}>
                                <input type="hidden" name="id" value={t.id} />
                                <button
                                  type="submit"
                                  className="text-xs font-semibold text-red-600 underline underline-offset-4"
                                >
                                  Delete
                                </button>
                              </form>
                            )}
                          </td>
                        </tr>
                      );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {editMode && (
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => addSegment(cat.id)}
                    className="rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                  >
                    + Add range
                  </button>
                  <p className="text-xs text-zinc-500">Ensure ranges are continuous from 0-{maxTotalKg} kg.</p>
                </div>
              )}

              {/* Hidden forms to support Save all */}
              <div className="hidden">
                {catTiers.map((tier) => {
                  const isLastTier = lastTierId === tier.id && Number.isFinite(maxTotalKg) && maxTotalKg > 0;
                  const resolvedMax = isLastTier ? maxTotalKg : tier.max_kg;
                  return (
                    <form
                      key={tier.id}
                      data-tier-form
                      data-id={tier.id}
                      data-new={tier.isNew ? "true" : "false"}
                      action={upsertTier}
                    >
                      <input type="hidden" name="id" value={tier.isNew ? "" : tier.id} />
                      <input type="hidden" name="category_id" value={tier.category_id} />
                      <input type="hidden" name="min_kg" value={tier.min_kg} />
                      <input type="hidden" name="max_kg" value={resolvedMax} />
                      <input type="hidden" name="price" value={tier.price} />
                      <input type="hidden" name="per_kg" value={tier.per_kg ? "on" : ""} />
                      <input type="hidden" name="notes" value={tier.notes ?? ""} />
                    </form>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

