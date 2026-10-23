import { describe, expect, it } from "vitest";
import {
  buildStatsDataset,
  buildTrend,
  comparisonRange,
  csvCell,
  defaultFilters,
  filterOrders,
  parseFilters,
  perthDate,
  rankLines,
  resolveRange,
  summarize,
  validDate,
  type StatsRow,
} from "./statsModel";

const row = (changes: Partial<StatsRow> = {}): StatsRow => ({
  id: "row-1",
  order_number: "0042",
  created_at: "2026-10-01T23:00:00Z",
  due_date: "2026-10-20",
  customer_name: "Test Customer",
  customer_email: "customer@example.com",
  first_name: null,
  last_name: null,
  phone: null,
  organization_name: null,
  category_id: "branded",
  design_type: "branded",
  packaging_option_id: "bag",
  flavor: "Lime, Cherry",
  total_price: 100,
  total_weight_kg: 5,
  paid_at: "2026-10-01T23:00:00Z",
  refunded_at: null,
  refunded_amount: null,
  status: "pending",
  pickup: false,
  state: "Western Australia",
  payment_provider: "square",
  payment_method: null,
  square_invoice_status: null,
  made: false,
  shipped_at: null,
  archived_at: null,
  ...changes,
});
const dataset = (rows: StatsRow[]) =>
  buildStatsDataset(
    rows,
    new Map([["branded", "Branded candy"]]),
    new Map([["bag", "Zip bag"]]),
    "2026-10-23T04:00:00Z",
  );

describe("stats v2 reporting", () => {
  it("groups split checkouts once while preserving line-level products and money", () => {
    const result = dataset([
      row({ order_number: "0042-a", total_price: 100.1 }),
      row({
        id: "row-2",
        order_number: "0042-b",
        design_type: "premade",
        category_id: "premade",
        total_price: 25.2,
      }),
    ]);
    expect(result.orders).toHaveLength(1);
    expect(result.orders[0]).toMatchObject({
      number: "0042",
      gross: 12530,
      net: 12530,
      kind: "Mixed",
      state: "WA",
    });
    expect(
      rankLines(result.orders, "category").reduce(
        (sum, item) => sum + item.net,
        0,
      ),
    ).toBe(12530);
  });

  it("subtracts only the recorded partial refund, including paid/unpaid lines", () => {
    const result = dataset([
      row({
        order_number: "0042-a",
        total_price: 100,
        refunded_amount: 20,
        refunded_at: "2026-10-03",
        status: "partially-refunded",
      }),
      row({
        id: "row-2",
        order_number: "0042-b",
        paid_at: null,
        total_price: 50,
      }),
    ]);
    expect(summarize(result.orders)).toMatchObject({
      gross: 15000,
      refund: 2000,
      net: 13000,
      paid: 8000,
      unpaid: 5000,
      average: 13000,
    });
  });

  it("supports historical full refunds, caps refunds, and leaves ambiguous partial refunds intact", () => {
    const result = dataset([
      row({ refunded_at: "2026-10-03", status: "refunded" }),
      row({ id: "2", order_number: "0043", refunded_amount: 500 }),
      row({
        id: "3",
        order_number: "0044",
        refunded_at: "2026-10-03",
        status: "partially-refunded",
      }),
    ]);
    expect(result.orders.map((order) => order.net)).toEqual([0, 0, 10000]);
    expect(summarize(result.orders).refund).toBe(20000);
  });

  it("excludes cancelled/draft/failed lines but retains archived history", () => {
    const result = dataset([
      row({ status: "cancelled" }),
      row({ status: "draft" }),
      row({ status: "failed" }),
      row({ status: "archived" }),
    ]);
    expect(result.excludedLines).toBe(3);
    expect(result.orders).toHaveLength(1);
    expect(result.orders[0].complete).toBe(true);
  });

  it("uses Perth creation days and inclusive dates for reporting boundaries", () => {
    expect(perthDate("2026-09-30T17:00:00Z")).toBe("2026-10-01");
    expect(validDate("2026-02-30")).toBe(false);
    const orders = dataset([
      row({ created_at: "2026-09-30T17:00:00Z" }),
      row({
        id: "2",
        order_number: "0043",
        created_at: "2026-10-01T16:00:00Z",
      }),
    ]).orders;
    expect(
      filterOrders(orders, defaultFilters, {
        from: "2026-10-01",
        to: "2026-10-01",
      }),
    ).toHaveLength(1);
  });

  it("compares equal inclusive periods and handles leap years", () => {
    expect(
      comparisonRange({ from: "2026-10-01", to: "2026-10-23" }, "previous"),
    ).toEqual({ from: "2026-09-08", to: "2026-09-30" });
    expect(
      comparisonRange({ from: "2024-02-29", to: "2024-03-01" }, "year"),
    ).toEqual({ from: "2023-02-28", to: "2023-03-01" });
    expect(
      resolveRange({ ...defaultFilters, period: "fy" }, "2026-01-10", "").from,
    ).toBe("2025-07-01");
    expect(
      resolveRange({ ...defaultFilters, period: "30d" }, "2026-10-23", "").from,
    ).toBe("2026-09-24");
  });

  it("classifies a returning order only after a previous nonzero checkout, without exposing identities", () => {
    const result = dataset([
      row(),
      row({
        id: "2",
        order_number: "0043",
        created_at: "2026-10-15T00:00:00Z",
        customer_email: "CUSTOMER@example.com",
      }),
      row({
        id: "3",
        order_number: "0044",
        customer_email: null,
        customer_name: "Test Customer",
      }),
    ]);
    expect(result.orders.filter((order) => order.returning)).toHaveLength(1);
    expect(
      result.orders.find((order) => order.number === "0044")?.customerKey,
    ).toBeNull();
    expect(JSON.stringify(result)).not.toContain("customer@example.com");
    const filtered = filterOrders(result.orders, defaultFilters, {
      from: "2026-10-10",
      to: "2026-10-23",
    });
    expect(summarize(filtered).returning).toBe(1);
  });

  it("deduplicates a flavour at checkout level and retains multi-flavour overlap", () => {
    const result = dataset([
      row({ order_number: "42-a" }),
      row({ id: "2", order_number: "42-b", flavor: "Lime" }),
    ]);
    const ranks = rankLines(result.orders, "flavors");
    expect(ranks.find((item) => item.label === "Lime")?.orders).toBe(1);
    expect(ranks.find((item) => item.label === "Cherry")?.orders).toBe(1);
  });

  it("does not merge unknown customer identities or placeholder phone values", () => {
    const result = dataset([
      row({ customer_email: "unknown", phone: "N/A" }),
      row({
        id: "2",
        order_number: "43",
        customer_email: "unknown",
        phone: "N/A",
      }),
    ]);
    expect(result.orders.every((order) => order.customerKey === null)).toBe(
      true,
    );
    expect(summarize(result.orders).returning).toBe(0);
  });

  it("filters by payment/fulfilment/type and uses the same segments for comparisons", () => {
    const orders = dataset([
      row(),
      row({
        id: "2",
        order_number: "43",
        paid_at: null,
        pickup: true,
        design_type: "premade",
      }),
    ]).orders;
    const range = { from: "2026-10-01", to: "2026-10-23" };
    expect(
      filterOrders(
        orders,
        {
          ...defaultFilters,
          payment: "unpaid",
          fulfillment: "Pickup",
          kind: "Pre-made",
        },
        range,
      ),
    ).toHaveLength(1);
    expect(
      filterOrders(
        orders,
        { ...defaultFilters, payment: "paid", fulfillment: "Pickup" },
        range,
      ),
    ).toHaveLength(0);
  });

  it("builds zero-filled buckets and aligns the comparison period", () => {
    const orders = dataset([row()]).orders;
    const range = { from: "2026-10-01", to: "2026-10-03" };
    const points = buildTrend(orders, orders, range, range, "net");
    expect(points).toHaveLength(3);
    expect(points.map((point) => point.net)).toEqual([0, 10000, 0]);
    expect(points.map((point) => point.previous)).toEqual([0, 10000, 0]);
    expect(
      buildTrend(
        orders,
        [],
        { from: "2026-10-03", to: "2026-10-01" },
        null,
        "orders",
      ),
    ).toEqual([]);
  });

  it("counts invalid creation dates rather than inventing sales dates", () => {
    const result = dataset([row({ created_at: "bad-date" })]);
    expect(result.undatedOrders).toBe(1);
    expect(
      filterOrders(result.orders, defaultFilters, {
        from: "2026-01-01",
        to: "2026-12-31",
      }),
    ).toHaveLength(0);
  });

  it("escapes CSV values, including spreadsheet formulas", () => {
    expect(csvCell('Hello, "Mum"')).toBe('"Hello, ""Mum"""');
    expect(csvCell("=IMPORTDATA(A1)")).toBe('"\'=IMPORTDATA(A1)"');
    expect(csvCell(" @SUM(1)")).toBe('"\' @SUM(1)"');
    expect(csvCell(15.5)).toBe('"15.5"');
  });

  it("rejects invalid dates/presets when opening a shared reporting link", () => {
    expect(
      parseFilters(
        new URLSearchParams(
          "period=invalid&from=2026-99-99&to=invalid&comparison=invalid",
        ),
      ),
    ).toEqual(defaultFilters);
  });
});
