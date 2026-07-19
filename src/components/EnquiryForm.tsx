"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  ENQUIRY_INTERESTS,
  enquiryInterestLabel,
  type EnquiryInterest,
} from "@/lib/enquiry";
import { trackEnquiryFormStart, trackGenerateLead } from "@/lib/analyticsEvents";

type EnquiryFormProps = {
  initialInterest?: EnquiryInterest;
  productContext?: string | null;
  sourcePage?: string | null;
};

type EnquiryResponse = {
  ok?: boolean;
  reference?: string;
  error?: string;
};

const MAX_ATTACHMENT_COUNT = 3;
const MAX_ATTACHMENT_BYTES = 4_000_000;
const ALLOWED_ATTACHMENT_EXTENSIONS = new Set([
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "heic",
  "ai",
  "eps",
]);

function attachmentExtension(filename: string) {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

function validateAttachments(files: File[]) {
  if (files.length > MAX_ATTACHMENT_COUNT) {
    return `Please choose no more than ${MAX_ATTACHMENT_COUNT} files.`;
  }
  if (files.some((file) => !ALLOWED_ATTACHMENT_EXTENSIONS.has(attachmentExtension(file.name)))) {
    return "Attachments must be PDF, PNG, JPG, WEBP, HEIC, AI, or EPS files.";
  }
  if (files.reduce((total, file) => total + file.size, 0) > MAX_ATTACHMENT_BYTES) {
    return "Attachments must be no more than 4 MB combined.";
  }
  return null;
}

function localToday() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function EnquiryForm({
  initialInterest = "general",
  productContext = null,
  sourcePage = "/contact",
}: EnquiryFormProps) {
  const [interest, setInterest] = useState<EnquiryInterest>(initialInterest);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [attachmentNames, setAttachmentNames] = useState<string[]>([]);
  const startedAtRef = useRef(Date.now());
  const trackedStartRef = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const trackStartOnce = () => {
    if (trackedStartRef.current) return;
    trackedStartRef.current = true;
    trackEnquiryFormStart({
      leadType: interest,
      sourcePage: sourcePage || "/contact",
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const attachments = formData
      .getAll("attachments")
      .filter((value): value is File => typeof value !== "string" && value.size > 0);
    const attachmentError = validateAttachments(attachments);
    if (attachmentError) {
      setError(attachmentError);
      return;
    }

    setSubmitting(true);
    if (productContext) formData.set("productContext", productContext);
    if (sourcePage) formData.set("sourcePage", sourcePage);
    formData.set("startedAt", String(startedAtRef.current));

    try {
      const response = await fetch("/api/enquiries", {
        method: "POST",
        body: formData,
      });
      const result = (await response.json().catch(() => ({}))) as EnquiryResponse;
      if (!response.ok || !result.ok || !result.reference) {
        throw new Error(result.error || "We could not send your enquiry. Please try again.");
      }

      trackGenerateLead({
        leadType: interest,
        sourcePage: sourcePage || "/contact",
      });
      setReference(result.reference);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "We could not send your enquiry. Please try again.",
      );
      startedAtRef.current = Date.now() - 2_000;
    } finally {
      setSubmitting(false);
    }
  };

  const handleAttachmentsChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    const attachmentError = validateAttachments(files);
    if (attachmentError) {
      event.currentTarget.value = "";
      setAttachmentNames([]);
      setError(attachmentError);
      return;
    }
    setError(null);
    setAttachmentNames(files.map((file) => file.name));
  };

  if (reference) {
    return (
      <section
        id="enquiry-form"
        className="scroll-mt-32 rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm md:p-8"
        aria-live="polite"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Enquiry sent</p>
        <h2 className="site-subsection-title mt-2 text-zinc-800">Thanks — your email is on its way to Roc Candy</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-700">
          Your enquiry has been emailed directly to Roc Candy. A confirmation copy should also arrive at your email
          address; reply to it if you would like to add anything else.
        </p>
        <p className="mt-4 text-sm font-semibold text-emerald-800">Reference: {reference}</p>
      </section>
    );
  }

  return (
    <section
      id="enquiry-form"
      className="scroll-mt-32 rounded-3xl border border-[#f3d4df] bg-white p-6 shadow-sm md:p-8"
    >
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#e85f8c]">Online enquiry</p>
        <h2 className="site-subsection-title mt-2 text-[rgb(114,112,111)]">Tell us what you have in mind</h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          Your enquiry will be emailed directly to Roc Candy. We will reply to you by email, just like a normal
          conversation.
        </p>
        {productContext ? (
          <p className="mt-3 inline-flex rounded-full bg-[#fff2f6] px-3 py-1.5 text-xs font-semibold text-[#b6456b]">
            Enquiring about: {productContext}
          </p>
        ) : null}
      </div>

      <form
        className="mt-7 space-y-5"
        encType="multipart/form-data"
        onFocusCapture={trackStartOnce}
        onSubmit={handleSubmit}
        noValidate={false}
      >
        <div
          className="pointer-events-none absolute -left-[10000px] top-auto h-px w-px overflow-hidden"
          aria-hidden="true"
        >
          <label htmlFor="enquiry-website">Website</label>
          <input id="enquiry-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <label className="text-sm font-semibold text-zinc-700">
            Name <span className="text-[#e85f8c]">*</span>
            <input
              name="name"
              type="text"
              required
              minLength={2}
              maxLength={100}
              autoComplete="name"
              className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base font-normal text-zinc-900 outline-none transition focus:border-[#ff6f95] focus:ring-2 focus:ring-[#ff6f95]/20"
            />
          </label>

          <label className="text-sm font-semibold text-zinc-700">
            Email <span className="text-[#e85f8c]">*</span>
            <input
              name="email"
              type="email"
              required
              maxLength={254}
              autoComplete="email"
              className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base font-normal text-zinc-900 outline-none transition focus:border-[#ff6f95] focus:ring-2 focus:ring-[#ff6f95]/20"
            />
          </label>

          <label className="text-sm font-semibold text-zinc-700">
            Phone <span className="font-normal text-zinc-400">(optional)</span>
            <input
              name="phone"
              type="tel"
              maxLength={40}
              autoComplete="tel"
              className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base font-normal text-zinc-900 outline-none transition focus:border-[#ff6f95] focus:ring-2 focus:ring-[#ff6f95]/20"
            />
          </label>

          <label className="text-sm font-semibold text-zinc-700">
            Organisation <span className="font-normal text-zinc-400">(optional)</span>
            <input
              name="organisation"
              type="text"
              maxLength={150}
              autoComplete="organization"
              className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base font-normal text-zinc-900 outline-none transition focus:border-[#ff6f95] focus:ring-2 focus:ring-[#ff6f95]/20"
            />
          </label>

          <label className="text-sm font-semibold text-zinc-700">
            Interested in
            <select
              name="interest"
              value={interest}
              onChange={(event) => setInterest(event.target.value as EnquiryInterest)}
              className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base font-normal text-zinc-900 outline-none transition focus:border-[#ff6f95] focus:ring-2 focus:ring-[#ff6f95]/20"
            >
              {ENQUIRY_INTERESTS.map((value) => (
                <option key={value} value={value}>
                  {enquiryInterestLabel(value)}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-semibold text-zinc-700">
            Date required <span className="font-normal text-zinc-400">(optional)</span>
            <input
              name="requiredDate"
              type="date"
              min={localToday()}
              className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base font-normal text-zinc-900 outline-none transition focus:border-[#ff6f95] focus:ring-2 focus:ring-[#ff6f95]/20"
            />
          </label>
        </div>

        <label className="block text-sm font-semibold text-zinc-700">
          Approximate quantity <span className="font-normal text-zinc-400">(optional)</span>
          <input
            name="quantity"
            type="text"
            maxLength={100}
            placeholder="For example: 100 bags, 3kg, or not sure"
            className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base font-normal text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-[#ff6f95] focus:ring-2 focus:ring-[#ff6f95]/20"
          />
        </label>

        <label className="block text-sm font-semibold text-zinc-700">
          How can we help? <span className="text-[#e85f8c]">*</span>
          <textarea
            name="message"
            required
            minLength={10}
            maxLength={4_000}
            rows={6}
            placeholder="Tell us about your event, design, colours, timing, or any questions you have."
            className="mt-2 w-full resize-y rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base font-normal text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-[#ff6f95] focus:ring-2 focus:ring-[#ff6f95]/20"
          />
        </label>

        <div>
          <label className="block text-sm font-semibold text-zinc-700" htmlFor="enquiry-attachments">
            Attach files <span className="font-normal text-zinc-400">(optional)</span>
          </label>
          <input
            id="enquiry-attachments"
            name="attachments"
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.ai,.eps"
            onChange={handleAttachmentsChange}
            className="mt-2 block w-full cursor-pointer rounded-xl border border-zinc-200 bg-white text-sm font-normal text-zinc-600 file:mr-4 file:cursor-pointer file:border-0 file:bg-[#fff2f6] file:px-4 file:py-3 file:font-semibold file:text-[#b6456b] hover:file:bg-[#fce4ec] focus:outline-none focus:ring-2 focus:ring-[#ff6f95]/20"
          />
          <p className="mt-2 text-xs leading-5 text-zinc-500">
            Up to 3 PDF, PNG, JPG, WEBP, HEIC, AI, or EPS files; 4 MB combined.
          </p>
          {attachmentNames.length > 0 ? (
            <p className="mt-1 break-words text-xs font-medium text-zinc-600">
              Selected: {attachmentNames.join(", ")}
            </p>
          ) : null}
        </div>

        {error ? (
          <div
            ref={errorRef}
            role="alert"
            tabIndex={-1}
            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-300"
          >
            {error}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#ff6f95] px-7 py-3 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(255,111,149,0.24)] transition hover:bg-[#ff4f80] disabled:cursor-wait disabled:opacity-65"
          >
            {submitting ? "Sending enquiry..." : "Send enquiry"}
          </button>
          <p className="text-xs leading-5 text-zinc-500">
            Prefer email? Write directly to{" "}
            <a href="mailto:enquiries@roccandy.com.au" className="font-semibold text-[#d95582] underline">
              enquiries@roccandy.com.au
            </a>
            .
          </p>
        </div>
      </form>
    </section>
  );
}
