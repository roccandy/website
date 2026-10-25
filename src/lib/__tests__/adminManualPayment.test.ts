import { describe, expect, it } from "vitest";
import { manualPaymentDetails, verifiedSquarePaymentPatch } from "../adminManualPayment";

describe("bank transfer recording", () => {
  const orders = [{ total_price: 100 }, { total_price: 10 }];
  const now = new Date("2026-10-25T04:00:00Z");
  it("records full combined invoice amount, Perth date and reference", () => {
    expect(manualPaymentDetails(orders, { amount: "110.00", date: "2026-10-24", reference: " bank-123 " }, now)).toEqual({ amountCents:11000, paidAt:"2026-10-23T16:00:00.000Z", reference:"bank-123" });
  });
  it.each(["50", "110.01", "not money", "-1"])("rejects partial/mismatched amounts %s", amount => expect(() => manualPaymentDetails(orders, {amount,date:"2026-10-25",reference:""},now)).toThrow("full invoice amount"));
  it.each(["2026-10-26", "2026-02-30", "bad"])("rejects invalid/future date %s",date=>expect(()=>manualPaymentDetails(orders,{amount:110,date,reference:""},now)).toThrow("payment date"));
  it.each(["UNPAID","DRAFT","PARTIALLY_PAID","PAYMENT_PENDING","CANCELED"])("does not mark published invoices paid while Square says %s",status=>expect(()=>verifiedSquarePaymentPatch({status},11000)).toThrow("Square has not confirmed"));
  it("only accepts a matching, fully paid AUD Square invoice", () => {
    const invoice={status:"PAID",version:4,payment_requests:[{total_completed_amount_money:{amount:11000,currency:"AUD"}}]};
    expect(verifiedSquarePaymentPatch(invoice,11000)).toEqual({square_invoice_status:"PAID",square_invoice_version:4,square_invoice_error:null});
    expect(()=>verifiedSquarePaymentPatch(invoice,10000)).toThrow("amount does not match");
    expect(()=>verifiedSquarePaymentPatch({...invoice,payment_requests:[{total_completed_amount_money:{amount:11000,currency:"USD"}}]},11000)).toThrow("amount does not match");
  });
});
