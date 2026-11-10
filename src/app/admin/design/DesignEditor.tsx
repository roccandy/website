"use client";
import { useEffect, useRef, useState, startTransition } from "react";
import { PrototypeStudio, type StudioHandle } from "./PrototypeStudio";
import {
  encodeStudioRecovery,
  readStudioRecovery,
  studioRecoveryKey,
  studioArtworkSignature,
} from "@/lib/designStudioRecovery";
import {
  designImageHref,
  parseCandyDesign,
  type CandyDesign,
} from "@/lib/candyDesign";
import {
  MAX_STUDIO_PROJECT_BYTES,
  parseStudioProject,
  type StudioProject,
} from "@/lib/studioProject";
import { importPrototypeProject } from "@/lib/studioPrototypeImport";
import { uploadStudioDataUrl } from "@/lib/studioClientAssets";
import { saveCandyDesign } from "./actions";
import { type SiteDesignerDefaults } from "@/lib/siteDesignerDefaults";
const button =
  "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40";
const primary =
  "rounded-lg bg-emerald-800 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-900 disabled:opacity-40";
export function DesignEditor({
  initialDesign,
  onApply,
  onClose,
  embedded = false,
  canWrite = true,
  recoveryScope,
}: {
  initialDesign: CandyDesign;
  onApply?: (design: CandyDesign) => void;
  onClose?: () => void;
  embedded?: boolean;
  canWrite?: boolean;
  recoveryScope?: string;
  siteDefaults?: SiteDesignerDefaults;
}) {
  const [design, setDesign] = useState(initialDesign);
  const [savedJson, setSavedJson] = useState(JSON.stringify(initialDesign));
  const projectRef = useRef(initialDesign.source);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const workspace = useRef<StudioHandle>(null);
  const [recovery, setRecovery] = useState<
    | (NonNullable<ReturnType<typeof readStudioRecovery>> & {
        legacy?: boolean;
      })
    | null
  >(null);
  const [closeChoice, setCloseChoice] = useState(false);
  const currentRef = useRef(design);
  useEffect(() => {
    currentRef.current = design;
  }, [design]);
  const dirty = JSON.stringify(design) !== savedJson;
  const pendingOrder =
    Boolean(onApply) &&
    studioArtworkSignature(design) !== studioArtworkSignature(initialDesign);
  const unsettled = dirty || pendingOrder;
  const recoveryKey = studioRecoveryKey(
    recoveryScope ||
      (initialDesign.source
        ? `library:${initialDesign.source.id}`
        : "new-design"),
  );
  const clearRecovery = () => {
    try {
      sessionStorage.removeItem(recoveryKey);
    } catch {}
  };
  const storeRecovery = () => {
    try {
      sessionStorage.setItem(
        recoveryKey,
        encodeStudioRecovery(currentRef.current, initialDesign),
      );
      return true;
    } catch {
      setError(
        "Browser recovery storage is full. Save your design before closing.",
      );
      return false;
    }
  };

  useEffect(() => {
    try {
      let draft = readStudioRecovery(
        sessionStorage.getItem(recoveryKey),
        initialDesign,
      ) as
        | (NonNullable<ReturnType<typeof readStudioRecovery>> & {
            legacy?: boolean;
          })
        | null;
      if (!draft && !embedded) {
        const raw = localStorage.getItem("roccandy-design-studio-draft-v1");
        const previous = raw ? parseCandyDesign(raw) : null;
        if (
          previous &&
          JSON.stringify(previous) !== JSON.stringify(initialDesign)
        ) {
          if (previous.source?.id !== initialDesign.source?.id)
            delete previous.source;
          draft = {
            design: previous,
            changedSource: true,
            savedAt: 0,
            legacy: true,
          };
        }
      }
      setRecovery(draft);
    } catch {
      /* A corrupt recovery draft never replaces the current document. */
    }
  }, [recoveryKey, initialDesign, embedded]);
  useEffect(() => {
    if (!unsettled || recovery) return;
    const timer = setTimeout(() => {
      try {
        sessionStorage.setItem(
          recoveryKey,
          encodeStudioRecovery(design, initialDesign),
        );
      } catch {
        setMessage(
          "Browser recovery storage is full. Save to the library to keep your changes.",
        );
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [design, unsettled, recovery, recoveryKey, initialDesign]);
  useEffect(() => {
    const leave = (e: BeforeUnloadEvent) => {
      if (unsettled) e.preventDefault();
    };
    const navigate = (e: Event) => {
      if (
        unsettled &&
        !window.confirm(
          pendingOrder
            ? "This artwork has not been applied to the order. Leave the Studio?"
            : "Leave Design Studio with unsaved changes?",
        )
      )
        e.preventDefault();
    };
    window.addEventListener("beforeunload", leave);
    window.addEventListener("admin:before-navigation", navigate);
    return () => {
      window.removeEventListener("beforeunload", leave);
      window.removeEventListener("admin:before-navigation", navigate);
    };
  }, [unsettled, pendingOrder]);
  const change = (next: CandyDesign) => {
    setDesign(next);
    setError("");
    setMessage("");
    currentRef.current = next;
  };
  const save = async (copy = false): Promise<CandyDesign | null> => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const design = await workspace.current!.prepare();
      const result = await saveCandyDesign(
        { ...design, source: projectRef.current },
        copy,
      );
      if (!result.ok) {
        setError(result.error);
        return null;
      }
      setDesign(result.design);
      setSavedJson(JSON.stringify(result.design));
      currentRef.current = result.design;
      projectRef.current = result.design.source;
      workspace.current?.markSaved(result.design);
      if (!embedded) {
        clearRecovery();
        window.history.replaceState(
          null,
          "",
          `/admin/design?design=${result.design.source.id}`,
        );
      }
      setMessage(
        `Saved to library · revision ${result.design.source.revision}`,
      );
      return result.design;
    } catch {
      setError(
        "The save could not be confirmed. Your design is still open; try saving again.",
      );
      return null;
    } finally {
      setBusy(false);
    }
  };
  const exportDesign = async (
    format: "png" | "pdf" | "svg" | "proof" | "jpeg",
    options: { resolution: "native" | 1 | 2 | 4 | 6; cropImages: boolean } = {
      resolution: "native",
      cropImages: false,
    },
  ) => {
    setBusy(true);
    setError("");
    try {
      const design = await workspace.current!.prepare();
      // Export through the same renderer used by confirmation emails.
      const response = await fetch("/api/admin/design/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          design,
          format,
          view: "three-dimensional",
          presentation: true,
          ...options,
        }),
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error || "Unable to export artwork.");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `${design.name.replace(/[^a-z0-9_-]/gi, "-")}${format === "proof" ? "-proof.pdf" : format === "jpeg" ? ".jpg" : `.${format}`}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to export artwork.");
    } finally {
      setBusy(false);
    }
  };
  const saveProject = async () => {
    setBusy(true);
    setError("");
    try {
      const design = await workspace.current!.prepare();
      const assets: Record<string, string> = {};
      await Promise.all(
        design.layers.map(async (l) => {
          if (l.type !== "image" || l.image.startsWith("data:")) return l;
          const response = await fetch(designImageHref(l.image));
          if (!response.ok)
            throw new Error(
              "Unable to load saved artwork for the project download.",
            );
          const image = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = reject;
            void response
              .blob()
              .then((blob) => reader.readAsDataURL(blob), reject);
          });
          assets[l.image] = image;
        }),
      );
      const project = parseStudioProject({
        format: "roccandy-studio",
        version: 1,
        design,
        assets,
      } satisfies StudioProject);
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(project)], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `${design.name.replace(/[^a-z0-9_-]/gi, "-")}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to download project.");
    } finally {
      setBusy(false);
    }
  };
  const openProject = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > MAX_STUDIO_PROJECT_BYTES)
        throw new Error("Choose a Studio JSON project up to 64MB.");
      const raw = JSON.parse(await file.text());
      setBusy(true);
      const imported =
        raw?.v === 1 && raw?.jacket
          ? await importPrototypeProject(raw, uploadStudioDataUrl)
          : undefined;
      const project = imported
        ? { design: imported.design, assets: {} as Record<string, string> }
        : parseStudioProject(raw);
      const next = project.design;
      if (
        dirty &&
        !window.confirm("Replace the current unsaved design with this project?")
      )
        return;
      setBusy(true);
      next.layers = await Promise.all(
        next.layers.map(async (l) =>
          l.type === "image" && project.assets[l.image]
            ? { ...l, ...(await uploadStudioDataUrl(project.assets[l.image])) }
            : l,
        ),
      );
      projectRef.current = undefined;
      change(next);
      await workspace.current?.load(next);
      if (imported?.warnings.length) setMessage(imported.warnings.join(" "));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to open project.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div aria-label="Candy Design Studio">
      {closeChoice && (
        <div
          role="group"
          aria-label="Unapplied artwork"
          className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm"
        >
          <p>
            {pendingOrder
              ? "This artwork is not applied to the order. Saving to the library alone does not update the order."
              : "Your artwork has unsaved changes."}
          </p>
          <div className="flex flex-wrap gap-2">
            {onApply && (
              <button
                type="button"
                className={primary}
                disabled={busy || !canWrite}
                onClick={() =>
                  startTransition(async () => {
                    const saved = await save();
                    if (saved) {
                      clearRecovery();
                      onApply(saved);
                    }
                  })
                }
              >
                Save & use in order
              </button>
            )}
            <button
              type="button"
              className={button}
              onClick={() => {
                if (storeRecovery()) onClose?.();
              }}
            >
              Keep recovery draft & close
            </button>
            <button
              type="button"
              className={button}
              onClick={() => {
                clearRecovery();
                onClose?.();
              }}
            >
              Discard editor changes & close
            </button>
            <button
              type="button"
              className={button}
              onClick={() => setCloseChoice(false)}
            >
              Continue editing
            </button>
          </div>
        </div>
      )}
      {recovery && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-amber-50 p-3 text-sm">
          <span>
            A browser recovery draft is available: {recovery.design.name}.
            {recovery.changedSource
              ? " The source has changed; restoring will save as a separate copy."
              : ""}
          </span>
          <button
            type="button"
            className={button}
            onClick={() => {
              change(recovery.design);
              void workspace.current?.load(recovery.design);
              projectRef.current = recovery.design.source;
              if (recovery.legacy)
                try {
                  sessionStorage.setItem(
                    recoveryKey,
                    encodeStudioRecovery(recovery.design, initialDesign),
                  );
                  localStorage.removeItem("roccandy-design-studio-draft-v1");
                } catch {}
              setRecovery(null);
            }}
          >
            Restore draft
          </button>
          <button
            type="button"
            className={button}
            onClick={() => {
              setRecovery(null);
              clearRecovery();
              if (recovery.legacy)
                try {
                  localStorage.removeItem("roccandy-design-studio-draft-v1");
                } catch {}
            }}
          >
            Dismiss
          </button>
        </div>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
        >
          {error}
        </p>
      )}
      {message && (
        <p
          role="status"
          className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900"
        >
          {message}
        </p>
      )}

      <PrototypeStudio
        ref={workspace}
        design={initialDesign}
        onChange={change}
        busy={busy}
        canWrite={canWrite}
        embedded={embedded || !!onApply}
        status={error || message}
        onSave={(copy) =>
          startTransition(async () => {
            await save(copy);
          })
        }
        onApply={() =>
          startTransition(async () => {
            const saved = await save();
            if (saved) {
              if (onApply) {
                clearRecovery();
                onApply(saved);
              } else if (saved.source)
                window.location.assign(
                  `/admin/orders/new?design=${saved.source.id}&revision=${saved.source.revision}`,
                );
            }
          })
        }
        onClose={
          onClose
            ? () => {
                if (unsettled) setCloseChoice(true);
                else onClose();
              }
            : undefined
        }
        onSaveProject={() => void saveProject()}
        onOpenProject={(file) => void openProject(file)}
        onExport={(format, options) => void exportDesign(format, options)}
      />
    </div>
  );
}
