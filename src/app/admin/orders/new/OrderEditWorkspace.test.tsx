import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { OrderEditWorkspace } from "./OrderEditWorkspace";

const invoice = (
  <section>
    <input name="customer_email" defaultValue="customer@example.com" />
  </section>
);
const details = (
  <section>
    <input name="quantity" defaultValue="100" />
  </section>
);

describe("Order edit workspace", () => {
  it("leaves creation markup and input order unchanged", () => {
    const original = renderToStaticMarkup(
      <>
        {invoice}
        {details}
      </>,
    );
    expect(
      renderToStaticMarkup(
        <OrderEditWorkspace editing={false} hasInvoice invoice={invoice}>
          {details}
        </OrderEditWorkspace>,
      ),
    ).toBe(original);
  });
  it("places the existing invoice and order fields in separate edit panes without duplicating fields", () => {
    const markup = renderToStaticMarkup(
      <OrderEditWorkspace editing hasInvoice invoice={invoice}>
        {details}
      </OrderEditWorkspace>,
    );
    expect(markup).toContain('aria-label="Invoice details editor"');
    expect(markup).toContain('aria-label="Order details editor"');
    expect(markup.match(/name="customer_email"/g)).toHaveLength(1);
    expect(markup.match(/name="quantity"/g)).toHaveLength(1);
    expect(markup.indexOf('name="customer_email"')).toBeLessThan(
      markup.indexOf('name="quantity"'),
    );
  });
  it("does not reserve an empty invoice column for internal stock", () => {
    const markup = renderToStaticMarkup(
      <OrderEditWorkspace editing hasInvoice={false} invoice={null}>
        {details}
      </OrderEditWorkspace>,
    );
    expect(markup).toContain("grid-cols-1");
    expect(markup).not.toContain("xl:grid-cols-");
    expect(markup).toContain('hidden=""');
    expect(markup).toContain('name="quantity"');
  });
});
