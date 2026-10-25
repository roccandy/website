import type { ReactNode } from "react";
import { AdminDataFreshness } from "./AdminDataFreshness";

/** A route-level timestamp travels with prefetched pages, across the entire admin. */
export default function AdminTemplate({ children }: { children: ReactNode }) {
  return <><AdminDataFreshness loadedAt={new Date().toISOString()} />{children}</>;
}
