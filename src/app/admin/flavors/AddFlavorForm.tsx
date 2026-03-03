"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { insertFlavor } from "./actions";

type ErrorInfo = { message: string };

export function AddFlavorForm() {
  const router = useRouter();
  const [error, setError] = useState<ErrorInfo | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const name = String(formData.get("name") || "").trim();
    if (!name) {
      setError({ message: "Flavor name required." });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: insertError } = await insertFlavor(name);
      if (insertError) {
        throw new Error(insertError);
      }

      form.reset();
      setSuccess("Flavor added.");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to add flavor.";
      setError({ message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3">
      <label className="text-xs uppercase tracking-[0.2em] text-zinc-500">
        Flavor name
        <input
          type="text"
          name="name"
          required
          className="mt-1 w-full rounded border border-zinc-200 px-3 py-2 text-sm"
          placeholder="e.g., Raspberry"
        />
      </label>
      <button
        type="submit"
        disabled={isSubmitting}
        className={`inline-flex items-center rounded-md px-3 py-2 text-sm font-semibold ${
          isSubmitting ? "bg-zinc-100 text-zinc-500" : "bg-zinc-900 text-white hover:bg-zinc-800"
        }`}
      >
        {isSubmitting ? "Adding..." : "Add flavor"}
      </button>
      {error && <p className="text-xs text-red-600">{error.message}</p>}
      {success && <p className="text-xs text-emerald-600">{success}</p>}
    </form>
  );
}
