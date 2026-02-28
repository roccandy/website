"use server";

import { redirect } from "next/navigation";
import { getManagedFaqItems, saveManagedFaqItems, type ManagedFaqItem } from "@/lib/faqs";

const FAQ_SETTINGS_PATH = "/admin/settings/faqs";

function normalizeField(value: FormDataEntryValue | null) {
  return (value?.toString() ?? "").replace(/\r\n/g, "\n").trim();
}

function reindex(items: ManagedFaqItem[]): ManagedFaqItem[] {
  return items.map((item, index) => ({ ...item, sortOrder: index }));
}

export async function addFaq(formData: FormData) {
  const question = normalizeField(formData.get("question"));
  const answerHtml = normalizeField(formData.get("answerHtml"));

  const current = await getManagedFaqItems();
  const next = reindex([
    ...current,
    {
      id: crypto.randomUUID(),
      question: question || "New FAQ",
      answerHtml: answerHtml || "<p>Add answer here.</p>",
      sortOrder: current.length,
    },
  ]);
  await saveManagedFaqItems(next);
  redirect(FAQ_SETTINGS_PATH);
}

export async function updateFaq(formData: FormData) {
  const id = normalizeField(formData.get("id"));
  if (!id) throw new Error("FAQ id is required.");

  const question = normalizeField(formData.get("question"));
  const answerHtml = normalizeField(formData.get("answerHtml"));
  if (!question || !answerHtml) {
    throw new Error("Question and answer are required.");
  }

  const current = await getManagedFaqItems();
  const next = reindex(
    current.map((item) =>
      item.id === id
        ? {
            ...item,
            question,
            answerHtml,
          }
        : item
    )
  );
  await saveManagedFaqItems(next);
  redirect(FAQ_SETTINGS_PATH);
}

export async function deleteFaq(formData: FormData) {
  const id = normalizeField(formData.get("id"));
  if (!id) throw new Error("FAQ id is required.");

  const current = await getManagedFaqItems();
  const next = reindex(current.filter((item) => item.id !== id));
  await saveManagedFaqItems(next);
  redirect(FAQ_SETTINGS_PATH);
}

export async function moveFaqUp(formData: FormData) {
  const id = normalizeField(formData.get("id"));
  if (!id) throw new Error("FAQ id is required.");

  const current = reindex(await getManagedFaqItems());
  const index = current.findIndex((item) => item.id === id);
  if (index <= 0) {
    redirect(FAQ_SETTINGS_PATH);
  }

  const next = [...current];
  [next[index - 1], next[index]] = [next[index], next[index - 1]];
  await saveManagedFaqItems(reindex(next));
  redirect(FAQ_SETTINGS_PATH);
}

export async function moveFaqDown(formData: FormData) {
  const id = normalizeField(formData.get("id"));
  if (!id) throw new Error("FAQ id is required.");

  const current = reindex(await getManagedFaqItems());
  const index = current.findIndex((item) => item.id === id);
  if (index === -1 || index >= current.length - 1) {
    redirect(FAQ_SETTINGS_PATH);
  }

  const next = [...current];
  [next[index], next[index + 1]] = [next[index + 1], next[index]];
  await saveManagedFaqItems(reindex(next));
  redirect(FAQ_SETTINGS_PATH);
}
