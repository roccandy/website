import type { ReactNode } from "react";

/** Creation keeps its existing DOM/layout; only the edit screen gets two panes. */
export function OrderEditWorkspace({
  editing,
  hasInvoice,
  invoice,
  children,
}: {
  editing: boolean;
  hasInvoice: boolean;
  invoice: ReactNode;
  children: ReactNode;
}) {
  if (!editing)
    return (
      <>
        {invoice}
        {children}
      </>
    );
  return (
    <div
      data-order-edit-layout
      className={`grid min-w-0 items-start gap-6 ${hasInvoice ? "xl:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]" : "grid-cols-1"}`}
    >
      <section
        aria-label="Invoice details editor"
        hidden={!hasInvoice}
        className="min-w-0"
      >
        {invoice}
      </section>
      <section
        aria-label="Order details editor"
        className="admin-order-editor-pane min-w-0 space-y-6"
      >
        {children}
      </section>
    </div>
  );
}
