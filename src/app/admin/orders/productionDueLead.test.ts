import { describe, expect, it } from "vitest";
import { productionDueLeadFromSlot } from "./productionScheduleShared";
import type { SettingsRow } from "@/lib/data";

const settings = {
  production_due_lead_days: {
    pickup: 3,
    WA: 3,
    NSW: 7,
  },
} as unknown as SettingsRow;

describe("production due lead", () => {
  it("measures the due date from the allocated production day", () => {
    expect(
      productionDueLeadFromSlot({
        dueDate: "2026-10-29",
        slotDate: "2026-10-26",
        pickup: false,
        state: "WA",
        settings,
      }),
    ).toMatchObject({ days: 3, label: "in 3 days", urgent: false });
  });

  it("uses the pickup and state-specific red thresholds", () => {
    expect(
      productionDueLeadFromSlot({
        dueDate: "2026-10-28",
        slotDate: "2026-10-26",
        pickup: true,
        state: "WA",
        settings,
      })?.urgent,
    ).toBe(true);

    expect(
      productionDueLeadFromSlot({
        dueDate: "2026-11-01",
        slotDate: "2026-10-26",
        pickup: false,
        state: "NSW",
        settings,
      })?.urgent,
    ).toBe(true);
  });
});
