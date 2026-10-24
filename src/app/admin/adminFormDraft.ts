const COMPUTED_FIELDS = new Set(["total_price", "order_weight_g", "order_description", "send_updated_invoice", "batch_weight_mismatch_approved"]);

export function draftFingerprint(entries: Iterable<[string, FormDataEntryValue]>) {
  return JSON.stringify(Array.from(entries).filter(([name]) => !COMPUTED_FIELDS.has(name)).map(([name, value]) => [name,
    typeof value === "string" ? value : value.name || value.size ? `${value.name}:${value.size}:${value.lastModified}` : "",
  ]));
}
