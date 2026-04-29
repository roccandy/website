import { describe, expect, it } from "vitest";
import {
  addRowsFromInsertSql,
  buildCustomerHistoryImport,
  rowsFromInsertStatement,
  type SqlTableRows,
} from "@/lib/customerHistoryImport";

describe("customer history import SQL parsing", () => {
  it("parses multi-row MySQL inserts with escaped strings, nulls, commas, and JSON", () => {
    const statement = String.raw`INSERT INTO ` + "`contactMessages`" + String.raw` (` +
      "`id`, `name`, `email`, `telephone`, `message`, `subscribed`, `created_at`" +
      String.raw`)
VALUES
	(1,'Jane O\'Neil','jane@example.com','0400 111 222','Hello, team\r\nCan you help?',1,'2024-01-01 10:00:00'),
	(2,'Json Person','json@example.com',NULL,'{\"note\":\"comma, inside\"}',0,NULL);`;

    const parsed = rowsFromInsertStatement(statement);

    expect(parsed.table).toBe("contactMessages");
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]).toMatchObject({
      id: 1,
      name: "Jane O'Neil",
      email: "jane@example.com",
      telephone: "0400 111 222",
      message: "Hello, team\r\nCan you help?",
      subscribed: 1,
    });
    expect(parsed.rows[1]).toMatchObject({
      id: 2,
      name: "Json Person",
      email: "json@example.com",
      telephone: null,
      message: "{\"note\":\"comma, inside\"}",
    });
  });

  it("adds parsed rows into table buckets", () => {
    const tables: SqlTableRows = {};
    addRowsFromInsertSql(
      tables,
      "INSERT INTO `payment_methods` (`payment_method_id`, `payment_method_name`)\nVALUES\n\t(1,'Credit Card'),\n\t(2,'Cheque');",
    );

    expect(tables).toEqual({
      payment_methods: [
        { payment_method_id: 1, payment_method_name: "Credit Card" },
        { payment_method_id: 2, payment_method_name: "Cheque" },
      ],
    });
  });
});

describe("customer history import transformation", () => {
  it("matches customers by normalized email across legacy and current orders", () => {
    const data = buildCustomerHistoryImport({
      legacyOld: {
        orders: [
          {
            order_id: 100,
            order_date: "2015-02-03 10:00:00",
            firstname: "Jane",
            surname: "Smith",
            email: "JANE@example.com ",
            telephone: "0400 111 222",
            address: "1 Test St",
            suburb: "Perth",
            state: "WA",
            postcode: "6000",
            total: 120,
            delivery_type_id: 1,
            gateway_response: "raw gateway should not be copied",
            cc_num: "4111111111111111",
          },
        ],
        shopping_cart_items: [
          {
            shopping_cart_item_id: 55,
            order_id: 100,
            title: "JANE HEART BOB",
            sales_type_id: 1,
            flavour_id: 4,
            quantity: 20,
            candy_weight: 1000,
            total: 120,
          },
        ],
        flavours: [{ flavour_id: 4, flavour: "Wildberry" }],
        sales_types: [{ sales_type_id: 1, short: "Names Heart", name: "Names and Heart" }],
      },
      currentOrders: [
        {
          id: "current-1",
          order_number: "RC-123",
          created_at: "2026-04-01T00:00:00.000Z",
          customer_name: "Jane Smith",
          customer_email: "jane@example.com",
          phone: "0400111222",
          total_price: 80,
          total_weight_kg: 0.5,
          status: "pending",
          pickup: false,
          title: "Custom order",
        },
      ],
    });

    expect(data.customers).toHaveLength(1);
    expect(data.customers[0]).toMatchObject({
      normalized_email: "jane@example.com",
      order_count: 2,
      lifetime_value: 200,
      match_confidence: "high",
    });
    expect(data.items).toHaveLength(2);
    expect(data.items[0]).toMatchObject({ flavor: "Wildberry", design_type: "Names Heart" });
    expect(data.orders[0].raw_sanitized).not.toHaveProperty("gateway_response");
    expect(data.orders[0].raw_sanitized).not.toHaveProperty("cc_num");
  });

  it("remaps earlier orders when later identities merge provisional customers", () => {
    const data = buildCustomerHistoryImport({
      legacyOld: {
        orders: [
          {
            order_id: 1,
            order_date: "2020-01-01 10:00:00",
            firstname: "Alex",
            surname: "Merge",
            email: "alex@example.com",
            total: 10,
          },
          {
            order_id: 2,
            order_date: "2020-02-01 10:00:00",
            firstname: "Alex",
            surname: "Merge",
            telephone: "0400 999 888",
            total: 20,
          },
          {
            order_id: 3,
            order_date: "2020-03-01 10:00:00",
            firstname: "Alex",
            surname: "Merge",
            email: "alex@example.com",
            telephone: "0400 999 888",
            total: 30,
          },
        ],
      },
    });

    const customerKeys = new Set(data.customers.map((customer) => customer.canonical_key));

    expect(data.customers).toHaveLength(1);
    expect(data.customers[0]).toMatchObject({ order_count: 3, lifetime_value: 60 });
    expect(data.orders).toHaveLength(3);
    expect(data.orders.every((order) => customerKeys.has(order.customer_key))).toBe(true);
    expect(new Set(data.orders.map((order) => order.customer_key)).size).toBe(1);
  });

  it("keeps orphaned legacy cart items on placeholder history records", () => {
    const data = buildCustomerHistoryImport({
      legacyOld: {
        orders: [],
        shopping_cart_items: [
          {
            shopping_cart_item_id: 9,
            order_id: 999,
            title: "TEST",
            date_added: "2014-03-07 10:31:21",
            total: 201.5,
          },
        ],
      },
    });

    expect(data.customers).toHaveLength(1);
    expect(data.orders).toHaveLength(1);
    expect(data.orders[0]).toMatchObject({
      source_id: "orphan-cart:999",
      display_order_number: "old orphan cart #999",
      order_status: "orphaned cart item",
      order_type: "cart-only",
      total_price: 201.5,
    });
    expect(data.items).toHaveLength(1);
    expect(data.items[0]).toMatchObject({
      order_source_id: "orphan-cart:999",
      source_order_id: "999",
      title: "TEST",
    });
  });

  it("sanitizes legacy-new payment payloads while preserving safe payment references", () => {
    const data = buildCustomerHistoryImport({
      legacyNew: {
        orders: [
          {
            id: 300,
            customer: "Sam Buyer",
            email: "sam@example.com",
            telephone: "0412 345 678",
            address1: "2 Test Rd",
            suburb: "Fremantle",
            state: "WA",
            postcode: "6160",
            orderTypeId: 2,
            orderStatusId: 15,
            paymentMethodId: 4,
            orderTotal: 42.84,
            paymentTotal: 42.84,
            paymentTimestamp: "2024-02-01 10:00:00",
            gatewayResult: "{\"payment\":{\"id\":\"square-payment-1\"}}",
            ccBrand: "VISA",
            ccLast4: "1234",
            ccExpiry: "1-2030",
            created_at: "2024-02-01 09:00:00",
          },
        ],
        orderTypes: [{ id: 2, title: "Retail" }],
        orderStatuses: [{ id: 15, title: "Shipped and closed" }],
        paymentMethods: [{ id: 4, paymentMethod: "Paypal" }],
      },
    });

    expect(data.orders).toHaveLength(1);
    expect(data.orders[0]).toMatchObject({
      display_order_number: "new #300",
      payment_reference: "square-payment-1",
      payment_provider: "Paypal",
      card_brand: "VISA",
      card_last4: "1234",
    });
    expect(data.orders[0].raw_sanitized).toMatchObject({
      hasGatewayResult: true,
    });
    expect(data.orders[0].raw_sanitized).not.toHaveProperty("gatewayResult");
    expect(data.orders[0].raw_sanitized).not.toHaveProperty("ccExpiry");
  });
});
