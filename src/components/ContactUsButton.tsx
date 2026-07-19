"use client";

import { Mail, Phone, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

export const CONTACT_PHONE_DISPLAY = "0414 519 211";
export const CONTACT_PHONE_HREF = "tel:0414519211";

type ContactUsButtonProps = {
  email: string;
  emailHref?: string;
  phone?: string;
  phoneHref?: string;
  variant?: "header" | "footer";
  placement?: "bottom" | "top";
  align?: "right" | "center";
  className?: string;
};

function getEmailHref(email: string, emailHref?: string) {
  const trimmedHref = emailHref?.trim();
  if (trimmedHref) return trimmedHref;
  return `mailto:${email.trim()}`;
}

function buttonClass(variant: "header" | "footer") {
  if (variant === "footer") {
    return "inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[#ff5f99] px-4 text-sm font-semibold text-white transition hover:bg-[#ff4f8d]";
  }

  return "inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[#ffbfd0] bg-white px-3 text-sm font-semibold text-[#ff6f95] shadow-sm transition hover:border-[#ff6f95] hover:text-[#ff4f80]";
}

function panelClass(placement: "bottom" | "top", align: "right" | "center") {
  const vertical = placement === "top" ? "bottom-full mb-3" : "top-full mt-3";
  const horizontal = align === "center" ? "left-1/2 -translate-x-1/2" : "right-0";

  return [
    "absolute",
    vertical,
    horizontal,
    "z-[70] w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-zinc-200 bg-white p-3 text-left text-zinc-900 shadow-xl",
  ].join(" ");
}

export function ContactUsButton({
  email,
  emailHref,
  phone = CONTACT_PHONE_DISPLAY,
  phoneHref = CONTACT_PHONE_HREF,
  variant = "header",
  placement = "bottom",
  align = "right",
  className = "",
}: ContactUsButtonProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const resolvedEmailHref = getEmailHref(email, emailHref);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
        className={buttonClass(variant)}
      >
        <Mail className="h-4 w-4" aria-hidden="true" />
        <span>Contact Us</span>
      </button>

      {open ? (
        <div id={panelId} role="dialog" aria-label="Roc Candy contact details" className={panelClass(placement, align)}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[#ff5f99]">Contact Roc Candy</p>
            <button
              type="button"
              aria-label="Close contact details"
              onClick={() => setOpen(false)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="mt-3 space-y-2">
            <Link
              href="/contact#enquiry-form"
              onClick={() => setOpen(false)}
              className="flex min-h-10 items-center justify-center rounded-md bg-[#ff5f99] px-3 text-sm font-semibold text-white transition hover:bg-[#ff4f8d]"
            >
              Send an online enquiry
            </Link>
            <div className="grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-zinc-100 bg-zinc-50 p-2">
              <Mail className="h-4 w-4 text-[#ff5f99]" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-zinc-500">Email</p>
                <p className="break-words text-sm font-semibold text-zinc-900">{email}</p>
              </div>
              <a
                href={resolvedEmailHref}
                className="inline-flex h-8 items-center rounded-md bg-[#ff5f99] px-3 text-xs font-semibold text-white transition hover:bg-[#ff4f8d]"
              >
                Email
              </a>
            </div>

            <div className="grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-zinc-100 bg-zinc-50 p-2">
              <Phone className="h-4 w-4 text-[#ff5f99]" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-zinc-500">Phone</p>
                <p className="break-words text-sm font-semibold text-zinc-900">{phone}</p>
              </div>
              <a
                href={phoneHref}
                className="inline-flex h-8 items-center rounded-md bg-[#ff5f99] px-3 text-xs font-semibold text-white transition hover:bg-[#ff4f8d]"
              >
                Call
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
