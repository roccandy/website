import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import {
  studioCandyDesign,
  newDesignLayer,
  designLegacyFields,
} from "@/lib/candyDesign";
import { adminOrderRemakeInvoiceTabs } from "@/lib/adminOrderRemake";
import { parseAdminOrderDraftPayload } from "@/lib/adminOrderDrafts";
import { candyDesignPng } from "@/lib/candyDesignExport";
import type { OrderRow } from "@/lib/data";
const state = vi.hoisted(() => ({
  tables: new Map<string, Map<string, Record<string, unknown>>>(),
  images: new Map<string, Buffer>(),
  sent: vi.fn(),
  invoice: vi.fn(),
  counter: 0,
}));
const context = {
  categories: [{ id: "custom-7-14", name: "Custom candy" }],
  packagingOptions: [
    {
      id: "bulk",
      type: "bag",
      size: "1kg",
      allowed_categories: ["custom-7-14"],
      candy_weight_g: 1000,
      unit_price: 1,
    },
  ],
  tiers: [
    {
      category_id: "custom-7-14",
      min_kg: 0,
      max_kg: 20,
      price: 100,
      per_kg: false,
    },
  ],
  labelRanges: [],
  settings: {
    max_total_kg: 20,
    labels_max_bulk: 5000,
    labels_supplier_shipping: 0,
    labels_markup_multiplier: 1,
    ingredient_label_price: 0,
    jacket_two_colour: 0,
    jacket_pinstripe: 0,
    jacket_rainbow: 0,
    lead_time_days: 0,
    urgency_fee: 0,
    invoice_due_days: 7,
  },
};
vi.mock("server-only", () => ({}));
vi.mock("@/lib/adminAuth", () => ({
  requireAdminWriteAccess: async () => ({
    user: { email: "staff@example.test", role: "admin", canWrite: true },
  }),
  requireAdminSession: async () => ({ user: { role: "admin" } }),
}));
vi.mock("@/lib/adminActivity", () => ({ logAdminActivity: async () => {} }));
vi.mock("@/lib/adminRevalidation", () => ({ revalidateAdminPath: () => {} }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error(url), { digest: `NEXT_REDIRECT;${url}` });
  },
}));
vi.mock("@/lib/orderNumbers", () => ({
  generateOrderNumber: async () =>
    String(411 + state.counter++).padStart(4, "0"),
  normalizeBaseOrderNumber: (v: string) => v || null,
}));
vi.mock("@/lib/data", () => ({
  getSettings: async () => context.settings,
  getCategories: async () => context.categories,
  getWeightTiers: async () => context.tiers,
  getPackagingOptions: async () => context.packagingOptions,
  getLabelRanges: async () => [],
  getColorPalette: async () => [],
  getLabelTypes: async () => [],
}));
vi.mock("@/lib/email", () => ({
  getOrdersRecipients: () => [],
  sendEmail: state.sent,
  sendCustomerOrderConfirmationEmail: state.sent,
  sendCustomerOrderSummaryEmail: state.sent,
  sendCustomerRefundEmail: state.sent,
  sendOrderEmail: state.sent,
}));
vi.mock("@/lib/adminOrderIntegrations", async (original) => ({
  ...(await original<typeof import("@/lib/adminOrderIntegrations")>()),
  createAdminSquareInvoiceDraft: state.invoice,
}));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdminClient: {
    from: (table: string) => query(table),
    storage: {
      from: () => ({
        download: async (key: string) => ({
          data: state.images.has(key)
            ? new Blob([new Uint8Array(state.images.get(key)!)])
            : null,
          error: state.images.has(key) ? null : { message: "Missing artwork" },
        }),
        upload: async (key: string, bytes: Buffer) => {
          state.images.set(key, Buffer.from(bytes));
          return { error: null };
        },
      }),
    },
    rpc: async (name: string, args: Record<string, unknown>) => {
      const table =
          name === "save_candy_design" ? "candy_designs" : "admin_order_drafts",
        rows = state.tables.get(table)!;
      const id = String(args.p_id || randomUUID()),
        prior = rows.get(id),
        revision = Number(prior?.revision || 0) + 1;
      const row =
        name === "save_candy_design"
          ? { id, revision, document: args.p_document }
          : {
              id,
              revision,
              payload: args.p_payload,
              source_order_id: args.p_source_order_id,
              source_fingerprint: args.p_source_fingerprint,
              title: "Unsent fixture",
              updated_at: new Date().toISOString(),
              publishing_at: null,
              completed_at: null,
              discarded_at: null,
            };
      rows.set(id, structuredClone(row));
      return { data: row, error: null };
    },
  },
}));
function query(table: string) {
  const filters: ((row: Record<string, unknown>) => boolean)[] = [];
  let operation = "select",
    value: unknown,
    one = false;
  const execute = () => {
    const rows =
      state.tables.get(table) ?? new Map<string, Record<string, unknown>>();
    state.tables.set(table, rows);
    let result = [...rows.values()].filter((row) =>
      filters.every((f) => f(row)),
    );
    if (operation === "insert") {
      result = (Array.isArray(value) ? value : [value]).map((input) => ({
        id: randomUUID(),
        created_at: new Date().toISOString(),
        ...input,
      }));
      result.forEach((row) => rows.set(String(row.id), row));
    }
    if (operation === "update")
      result.forEach((row) => Object.assign(row, value));
    return {
      data: structuredClone(one ? (result[0] ?? null) : result),
      error: null,
    };
  };
  const q = {
    select: () => q,
    eq: (key: string, v: unknown) => {
      filters.push((r) => r[key] === v);
      return q;
    },
    in: (key: string, values: unknown[]) => {
      filters.push((r) => values.includes(r[key]));
      return q;
    },
    is: (key: string, v: unknown) => {
      filters.push((r) => (r[key] ?? null) === v);
      return q;
    },
    not: (key: string, _operator: string, v: unknown) => {
      filters.push((r) => (r[key] ?? null) !== v);
      return q;
    },
    order: () => q,
    update: (patch: unknown) => {
      operation = "update";
      value = patch;
      return q;
    },
    insert: (input: unknown) => {
      operation = "insert";
      value = input;
      return q;
    },
    single: async () => {
      one = true;
      return execute();
    },
    maybeSingle: async () => {
      one = true;
      return execute();
    },
    then: (resolve: (v: ReturnType<typeof execute>) => unknown) =>
      Promise.resolve(execute()).then(resolve),
  };
  return q;
}
import { saveCandyDesign } from "./actions";
import { saveOrderDraft } from "../orders/draftActions";
import { upsertOrderInline } from "../orders/actions";

describe("Studio → unsent draft → combined order → remake → resent confirmation", () => {
  beforeEach(() => {
    state.tables.clear();
    for (const table of [
      "orders",
      "candy_designs",
      "admin_order_drafts",
      "order_slots",
    ])
      state.tables.set(table, new Map());
    state.images.clear();
    state.counter = 0;
    state.sent.mockResolvedValue({ messageId: "test-only" });
    state.invoice.mockResolvedValue({
      customerId: "customer-fixture",
      squareOrderId: "square-fixture",
      invoiceId: "invoice-fixture",
      invoiceVersion: 1,
      invoiceStatus: "DRAFT",
      invoiceUrl: null,
      invoiceDueDate: "2027-01-01",
      invoiceCreatedAt: new Date().toISOString(),
    });
  });
  it("keeps both designs, original-resolution assets, complexity charges, quoted totals and resent PNGs in sync", async () => {
    const artwork = await sharp({
      create: { width: 1800, height: 600, channels: 4, background: "#ff0000" },
    })
      .png()
      .toBuffer();
    const first = studioCandyDesign("THANK YOU KARRI"),
      second = studioCandyDesign("ROAD SMART B");
    first.layers[0].text = "THANK YOU KARRI";
    first.productionNotes = "INTERNAL RECIPE";
    first.layers.push({
      ...newDesignLayer("image", "logo"),
      image: `data:image/png;base64,${artwork.toString("base64")}`,
    });
    second.jacket.mode = "segments";
    second.jacket.advanced!.segments = 12;
    const a = await saveCandyDesign(first),
      b = await saveCandyDesign(second);
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) throw new Error("Save failed");
    const savedAsset = a.design.layers[1].image;
    expect(savedAsset).toMatch(/^candy-asset:/);
    expect(
      (await sharp(state.images.get(savedAsset.slice(12))!).metadata()).width,
    ).toBe(1800);
    const fields = (
      design: typeof a.design,
      total: string,
      charge: string,
    ) => ({
      ...Object.fromEntries(
        Object.entries(designLegacyFields(design)).map(([k, v]) => [
          k,
          String(v),
        ]),
      ),
      title: design.name,
      candy_design: JSON.stringify(design),
      category_id: "custom-7-14",
      packaging_option_id: "bulk",
      quantity: "1",
      due_date: "2027-12-01",
      order_weight_g: "1000",
      total_price: total,
      admin_complexity_charge: charge,
    });
    const payload = parseAdminOrderDraftPayload({
      schemaVersion: 1,
      shared: { customer_email: "fixture@example.test", pickup: "on" },
      orders: [
        {
          id: "a",
          fields: fields(a.design, "4636.77", "80"),
          batchWeights: ["1"],
        },
        {
          id: "b",
          fields: fields(b.design, "4483.23", "35"),
          batchWeights: ["1"],
        },
      ],
      activeOrderId: "a",
      preserveQuotedPrices: true,
    });
    const draftId = randomUUID(),
      draft = await saveOrderDraft({
        id: draftId,
        revision: 0,
        sourceOrderId: null,
        sourceFingerprint: null,
        payload,
      });
    expect(draft.ok).toBe(true);
    expect(state.sent).not.toHaveBeenCalled();
    expect(state.tables.get("orders")!.size).toBe(0);
    const form = new FormData();
    form.set("submit_intent", "create_tabbed_invoice");
    form.set("customer_email", "fixture@example.test");
    form.set("pickup", "on");
    form.set("order_draft_id", draftId);
    form.set("order_draft_revision", "1");
    form.set("admin_invoice_orders_json", JSON.stringify(payload.orders));
    await expect(upsertOrderInline(form)).rejects.toThrow("/invoice");
    const orders = [
      ...state.tables.get("orders")!.values(),
    ] as unknown as OrderRow[];
    expect(orders).toHaveLength(2);
    expect(orders.map((o) => o.total_price)).toEqual([4636.77, 4483.23]);
    expect(orders.map((o) => o.admin_complexity_charge)).toEqual([80, 35]);
    expect(
      state.tables.get("admin_order_drafts")!.get(draftId)?.published_order_ids,
    ).toHaveLength(2);
    expect(state.sent).toHaveBeenCalledTimes(1);
    expect(state.sent.mock.calls[0][1].paymentAmount).toBe(9120);
    const remade = adminOrderRemakeInvoiceTabs(orders);
    expect(remade.map((o) => o.fields.total_price)).toEqual([
      "4636.77",
      "4483.23",
    ]);
    expect(remade.map((o) => o.fields.admin_complexity_charge)).toEqual([
      "80",
      "35",
    ]);
    expect(
      JSON.parse(remade[1].fields.candy_design).jacket.advanced.segments,
    ).toBe(12);
    const changed = structuredClone(a.design);
    changed.layers[0].text = "THANK YOU KARRI AGAIN";
    const update = new FormData();
    update.set("id", orders[0].id);
    update.set("submit_intent", "save_and_resend_confirmation");
    update.set("candy_design", JSON.stringify(changed));
    const result = await upsertOrderInline(update);
    expect(result).toMatchObject({ ok: true });
    const updated = state.tables.get("orders")!.get(orders[0].id)!;
    expect(updated.total_price).toBe(4636.77);
    expect(updated.admin_complexity_charge).toBe(80);
    const summary = state.sent.mock.calls.at(-1)![1];
    expect(summary.customDetails.studioDesignSummary.join("\n")).toContain(
      "THANK YOU KARRI AGAIN",
    );
    expect(summary.customDetails.studioDesignSummary.join("\n")).not.toContain(
      "INTERNAL RECIPE",
    );
    expect(
      Buffer.from(summary.customDetails.imageDataUrl.split(",")[1], "base64"),
    ).toEqual(await candyDesignPng(updated.candy_design as typeof changed));
    expect(
      (
        state.tables.get("orders")!.get(orders[1].id)!
          .candy_design as typeof changed
      ).name,
    ).toBe("ROAD SMART B");
  });
});
