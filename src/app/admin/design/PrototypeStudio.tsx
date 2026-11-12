"use client";
import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from "react";
import { createPortal } from "react-dom";
import { StudioCandyPreview } from "@/components/StudioCandyPreview";
import { designExportSize } from "@/lib/designImageBounds";
import { studioTextWarnings, type TextGeometry } from "@/lib/candyTextGeometry";
import { designSummary, type CandyDesign } from "@/lib/candyDesign";
import { mountStudioControls } from "./studioControls";
import {
  StudioExperienceAdapter,
  type ControlState,
} from "./studioExperienceAdapter";
import { studioExperienceTemplate as markup } from "./studioExperienceTemplate";

export type StudioHandle = {
  snapshot: () => CandyDesign;
  prepare: () => Promise<CandyDesign>;
  markSaved: (design: CandyDesign) => void;
  load: (design: CandyDesign) => Promise<void>;
};
type ExportOptions = {
  resolution: "native" | 1 | 2 | 4 | 6;
  cropImages: boolean;
};
type Props = {
  design: CandyDesign;
  onChange: (design: CandyDesign) => void;
  onSave: (copy: boolean) => void;
  onApply: () => void;
  onClose?: () => void;
  onLibrary?: () => void;
  onRecovery: () => void;
  hasRecovery: boolean;
  onSaveProject: () => void;
  onOpenProject: (file: File) => void;
  onExport: (
    format: "png" | "jpeg" | "pdf" | "proof" | "svg",
    options: ExportOptions,
  ) => void;
  onCopyToClipboard: () => void;
  busy: boolean;
  canWrite: boolean;
  embedded: boolean;
  status: string;
  ref: Ref<StudioHandle>;
};
export function PrototypeStudio({ ref, ...props }: Props) {
  const frame = useRef<HTMLIFrameElement>(null);
  const controls = useRef<ReturnType<typeof mountStudioControls> | null>(null);
  const adapter = useRef(new StudioExperienceAdapter(props.design));
  const callbacks = useRef(props);
  const current = useRef(props.design);
  const [preview, setPreview] = useState(props.design);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [geometry, setGeometry] = useState<TextGeometry>();
  const warning = studioTextWarnings(preview, geometry).join(" ");
  const [error, setError] = useState("");
  const assetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const generation = useRef(0);
  const alive = useRef(true);
  const lastState = useRef("");
  useEffect(() => {
    callbacks.current = props;
  });
  useEffect(
    () => () => {
      alive.current = false;
      controls.current?.destroy();
      clearTimeout(assetTimer.current);
    },
    [],
  );
  const changed = (state: ControlState, name: string) => {
    const design = adapter.current.toDesign(state, name);
    const signature = JSON.stringify({
      ...design,
      source: undefined,
      textGeometry: undefined,
    });
    if (signature === lastState.current) return;
    lastState.current = signature;
    current.current = design;
    const spec =
      frame.current?.contentDocument?.getElementById("productionSpec");
    if (spec) spec.textContent = designSummary(design, true).join("\n");
    setPreview({
      ...design,
      layers: design.layers.map((l) => {
        const control = state.layers.find((v) => String(v.id) === l.id);
        return control?.img
          ? { ...l, image: adapter.current.imageData(control.img) }
          : l;
      }),
    });
    // Parent saves/read guards always see the current complete artwork.
    callbacks.current.onChange(design);
    clearTimeout(assetTimer.current);
    const version = ++generation.current;
    assetTimer.current = setTimeout(() => {
      void adapter.current
        .prepare(design)
        .then((prepared) => {
          if (alive.current && generation.current === version) {
            current.current = prepared;
            callbacks.current.onChange(prepared);
          }
        })
        .catch((e) => {
          if (alive.current)
            setError(
              e instanceof Error
                ? e.message
                : "Artwork could not be stored. Keep this editor open and retry saving.",
            );
        });
    }, 700);
  };
  useImperativeHandle(ref, () => ({
    snapshot: () => current.current,
    prepare: () => {
      clearTimeout(assetTimer.current);
      generation.current++;
      return adapter.current.prepare(current.current);
    },
    markSaved: (design) => {
      current.current = design;
      adapter.current.base = { ...adapter.current.base, source: design.source };
      clearTimeout(assetTimer.current);
      generation.current++;
    },
    load: async (design) => {
      lastState.current = "";
      current.current = design;
      setPreview(design);
      await controls.current?.load(design);
    },
  }));
  useEffect(() => {
    const doc = frame.current?.contentDocument;
    if (!doc?.querySelector("#saveLibrary")) return;
    doc.querySelector(".app")?.setAttribute("aria-busy", String(props.busy));
    for (const id of ["saveLibrary", "saveCopy", "useOrder", "copyClipboard"])
      (doc.getElementById(id) as HTMLButtonElement).disabled =
        props.busy || !props.canWrite;
    const status = doc.getElementById("integrationStatus");
    if (status) status.textContent = props.status || error || warning;
    const library = doc.getElementById("browseLibrary");
    if (library) library.hidden = !props.onLibrary;
    const recovery = doc.getElementById("recoverWork");
    if (recovery) recovery.hidden = !props.hasRecovery;
  }, [
    props.busy,
    props.canWrite,
    props.status,
    error,
    host,
    warning,
    props.onLibrary,
    props.hasRecovery,
  ]);
  // The canvas is only a colour-sampling buffer. All visible candy and exports use CandyDesignSvg.
  useEffect(() => {
    if (!host) return;
    let version = 0,
      disposed = false;
    const sample = () => {
      const svg = host.querySelector("svg");
      if (!svg) return;
      const currentVersion = ++version,
        copy = svg.cloneNode(true) as SVGElement;
      copy.setAttribute("width", "1772");
      copy.setAttribute("height", "1300");
      const url = URL.createObjectURL(
        new Blob([new XMLSerializer().serializeToString(copy)], {
          type: "image/svg+xml",
        }),
      );
      const image = new Image();
      image.onload = () => {
        if (!disposed && version === currentVersion) {
          const canvas =
            frame.current?.contentDocument?.querySelector<HTMLCanvasElement>(
              "#main",
            );
          const ctx = canvas?.getContext("2d");
          ctx?.clearRect(0, 0, 1772, 1300);
          ctx?.drawImage(image, 0, 0, 1772, 1300);
        }
        URL.revokeObjectURL(url);
      };
      image.onerror = () => URL.revokeObjectURL(url);
      image.src = url;
    };
    const observer = new MutationObserver(sample);
    observer.observe(host, {
      subtree: true,
      childList: true,
      attributes: true,
    });
    sample();
    return () => {
      disposed = true;
      observer.disconnect();
    };
  }, [host]);
  const init = async () => {
    const doc = frame.current?.contentDocument,
      win = frame.current?.contentWindow;
    if (!doc || !win) return;
    controls.current?.destroy();
    alive.current = true;
    try {
      const engine = mountStudioControls(doc, win, {
        changed,
        fontFamily: adapter.current.fontFamily,
        faceRadius: adapter.current.faceRadius,
        invalidate: adapter.current.invalidate,
        rememberImage: adapter.current.rememberImage,
        jacketPaths: adapter.current.jacketPaths,
        load: (design: CandyDesign) => adapter.current.load(design, doc),
        save: (copy: boolean) => callbacks.current.onSave(copy),
        apply: () => callbacks.current.onApply(),
        close: () => callbacks.current.onClose?.(),
        library: () => callbacks.current.onLibrary?.(),
        recovery: () => callbacks.current.onRecovery(),
        saveProject: () => callbacks.current.onSaveProject(),
        openProject: (file: File) => callbacks.current.onOpenProject(file),
        proof: (format: "pdf" | "proof" | "svg") =>
          callbacks.current.onExport(format, {
            resolution: 1,
            cropImages: false,
          }),
        export: (
          _state: ControlState,
          format: "png" | "jpeg",
          resolution: string,
          cropImages: boolean,
        ) =>
          callbacks.current.onExport(format, {
            resolution:
              resolution === "auto"
                ? "native"
                : (Number(resolution) as 2 | 4 | 6),
            cropImages,
          }),
        copyToClipboard: () => callbacks.current.onCopyToClipboard(),
        exportInfo: (
          state: ControlState,
          resolution: string,
          cropImages: boolean,
          el: HTMLElement,
        ) => {
          try {
            const size = designExportSize(adapter.current.toDesign(state), {
              resolution:
                resolution === "auto"
                  ? "native"
                  : (Number(resolution) as 2 | 4 | 6),
              cropImages,
            });
            el.textContent = `Will save ${size.width} × ${size.height} px${size.capped ? " (reduced to the supported export size)" : ""}.`;
          } catch {
            el.textContent = "Add a visible image to crop to artwork.";
          }
        },
      });
      controls.current = engine;
      setHost(engine.element);
      const useOrder = doc.getElementById("useOrder")!;
      useOrder.textContent = props.embedded
        ? "Save & use in order"
        : "Create order";
      if (!props.onClose) doc.getElementById("closeStudio")!.hidden = true;
      await engine.load(current.current);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to open the design.");
    }
  };
  return (
    <>
      {error && (
        <p role="alert" className="p-3 text-sm text-rose-800">
          {error}
        </p>
      )}
      <iframe
        ref={frame}
        title="Roc Candy Mockup Studio"
        srcDoc={markup}
        onLoad={() => void init()}
        className="studio-experience-frame"
        style={{
          width: "100%",
          height: "max(540px, calc(100dvh - 160px))",
          border: 0,
          display: "block",
        }}
      />
      {host &&
        createPortal(
          <StudioCandyPreview
            design={preview}
            prefix="studio-canonical"
            showBackground
            onGeometry={setGeometry}
          />,
          host,
        )}
    </>
  );
}
