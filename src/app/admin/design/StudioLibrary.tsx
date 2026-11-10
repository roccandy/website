"use client";
import { useEffect, useState, useId } from "react";
import { AdminLink } from "@/app/admin/AdminNavigationFeedback";
import { CandyPreview } from "@/app/quote/CandyPreview";
import type { CandyDesign } from "@/lib/candyDesign";
import { StudioPanel } from "./StudioPanel";

type Library = {
  designs: {
    id: string;
    name: string;
    revision: number;
    updatedAt: string;
    design: CandyDesign | null;
  }[];
  count: number;
  page: number;
  revisions: { revision: number }[];
};
export function StudioLibrary({
  onClose,
  currentDesign,
}: {
  onClose: () => void;
  currentDesign?: CandyDesign["source"];
}) {
  const newDesignId = useId();
  const [search, setSearch] = useState(""),
    [query, setQuery] = useState({ search: "", page: 0, attempt: 0 }),
    [data, setData] = useState<Library>(),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController(),
      params = new URLSearchParams({
        q: query.search,
        page: String(query.page),
      });
    if (currentDesign) params.set("design", currentDesign.id);
    void fetch(`/api/admin/design/library?${params}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error || "Unable to load designs.");
        return result as Library;
      })
      .then((result) => {
        setData(result);
        setError("");
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "Unable to load designs.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query, currentDesign]);
  const navigate = (page: number) => {
    setLoading(true);
    setQuery({ ...query, page });
  };
  return (
    <StudioPanel title="Design library" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setLoading(true);
          setQuery({ search, page: 0, attempt: query.attempt + 1 });
        }}
        className="mb-5 flex gap-2"
      >
        <input
          aria-label="Search design library"
          placeholder="Search saved designs"
          value={search}
          maxLength={100}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        >
          Search
        </button>
        <AdminLink
          href={`/admin/design?new=${encodeURIComponent(newDesignId)}`}
          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        >
          New design
        </AdminLink>
      </form>
      {loading ? (
        <p role="status" className="text-sm text-zinc-500">
          Loading designs…
        </p>
      ) : error ? (
        <div role="alert">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setQuery({ ...query, attempt: query.attempt + 1 });
            }}
            className="mt-3 rounded border px-3 py-2 text-sm"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          <p className="mb-3 text-xs text-zinc-500">
            {data?.count || 0} {query.search ? "matching" : "saved"} designs
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data?.designs.map((row) => (
              <AdminLink
                key={row.id}
                href={`/admin/design?design=${row.id}`}
                className="rounded-lg border border-zinc-200 p-3 text-sm hover:bg-zinc-50"
              >
                <CandyPreview
                  design={row.design}
                  mode=""
                  colorOne="#d1d5db"
                  colorTwo="#d1d5db"
                  dimensions={{ width: 180, height: 134 }}
                />
                <span className="block truncate font-semibold">{row.name}</span>
                <span className="text-xs text-zinc-500">
                  Revision {row.revision} ·{" "}
                  {new Date(row.updatedAt).toLocaleDateString("en-AU", {
                    timeZone: "Australia/Perth",
                  })}
                </span>
              </AdminLink>
            ))}
          </div>
          {!data?.designs.length && (
            <p className="text-sm text-zinc-500">
              {query.search
                ? "No designs match this name."
                : "Saved designs will appear here."}
            </p>
          )}
          <nav
            aria-label="Library pages"
            className="mt-5 flex items-center justify-between gap-3 text-sm"
          >
            <button
              type="button"
              disabled={!query.page}
              onClick={() => navigate(query.page - 1)}
              className="rounded border px-3 py-2 disabled:opacity-30"
            >
              Previous
            </button>
            <span>
              Page {query.page + 1} of{" "}
              {Math.max(1, Math.ceil((data?.count || 0) / 24))}
            </span>
            <button
              type="button"
              disabled={(data?.count || 0) <= (query.page + 1) * 24}
              onClick={() => navigate(query.page + 1)}
              className="rounded border px-3 py-2 disabled:opacity-30"
            >
              Next
            </button>
          </nav>
          {currentDesign && !!data?.revisions.length && (
            <details className="mt-6 border-t pt-4 text-sm">
              <summary>Previous revisions of this design</summary>
              <div className="mt-3 flex flex-wrap gap-3">
                {data.revisions.map((row) => (
                  <AdminLink
                    className="underline"
                    key={row.revision}
                    href={`/admin/design?design=${currentDesign.id}&revision=${row.revision}`}
                  >
                    Revision {row.revision}
                  </AdminLink>
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </StudioPanel>
  );
}
