"use client";
import { useEffect, useState, type ComponentProps } from "react";
import { CandyDesignSvg } from "@/components/CandyDesignSvg";
import {
  parseTextGeometry,
  textGeometrySignature,
  type TextGeometry,
} from "@/lib/candyTextGeometry";
const cache = new Map<string, TextGeometry>();
export function StudioCandyPreview({
  onGeometry,
  ...props
}: ComponentProps<typeof CandyDesignSvg> & {
  onGeometry?: (geometry: TextGeometry) => void;
}) {
  const signature = textGeometrySignature(props.design);
  const [result, setResult] = useState<TextGeometry | undefined>(
    props.design.textGeometry,
  );
  const geometry =
    props.design.textGeometry?.signature === signature
      ? props.design.textGeometry
      : result?.signature === signature
        ? result
        : cache.get(signature);
  const [error, setError] = useState("");
  useEffect(() => {
    if (geometry) {
      onGeometry?.(geometry);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/admin/design/text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            design: {
              ...props.design,
              textGeometry: undefined,
              layers: props.design.layers.filter((l) => l.type === "text"),
            },
          }),
        });
        const payload = await response.json();
        if (!response.ok)
          throw new Error(payload.error || "Unable to render lettering.");
        const next = parseTextGeometry(payload);
        if (!next || next.signature !== signature)
          throw new Error("Lettering preview could not be verified.");
        if (cache.size >= 30) cache.delete(cache.keys().next().value!);
        cache.set(signature, next);
        setResult(next);
        setError("");
        onGeometry?.(next);
      } catch (e) {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error ? e.message : "Unable to render lettering.",
          );
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // Position, colour and rotation are applied separately to the same glyphs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, Boolean(geometry)]);
  return (
    <>
      <CandyDesignSvg
        {...props}
        design={{ ...props.design, textGeometry: geometry }}
      />
      {error && !geometry && (
        <p role="alert" className="text-xs text-rose-700">
          {error}
        </p>
      )}
    </>
  );
}
