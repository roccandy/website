import { describe, expect, it } from "vitest";
import type { PackagingOption } from "@/lib/data";
import { sortPackagingOptions } from "@/lib/packaging";

const option = (id: string, type: string, size: string, typeOrder: number, sortOrder: number) =>
  ({
    id,
    type,
    size,
    type_sort_order: typeOrder,
    sort_order: sortOrder,
  }) as PackagingOption;

describe("packaging ordering", () => {
  it("sorts types first and options by their saved order within each type", () => {
    const options = [
      option("jar-large", "Jar", "Large", 1, 1),
      option("bag", "Clear Bag", "100pc", 0, 0),
      option("jar-small", "Jar", "Small", 1, 0),
    ];

    expect(sortPackagingOptions(options).map((item) => item.id)).toEqual([
      "bag",
      "jar-small",
      "jar-large",
    ]);
  });
});
