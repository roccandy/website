"use server";

import { redirect } from "next/navigation";
import { appendAdminToast, requireAdminSeoWriteAccess } from "@/lib/adminAuth";
import { getManagedFaqItems, saveManagedFaqItems, type ManagedFaqItem } from "@/lib/faqs";
import { renderTextContentToHtml } from "@/lib/textContentEditor";

const FAQ_SETTINGS_PATH = "/admin/settings/faqs";

function normalizeField(value: FormDataEntryValue | null) {
  return (value?.toString() ?? "").replace(/\r\n/g, "\n").trim();
}

function reindex(items: ManagedFaqItem[]): ManagedFaqItem[] {
  return items.map((item, index) => ({ ...item, sortOrder: index }));
}

export async function addFaq(formData: FormData) {
  await requireAdminSeoWriteAccess({ onDenied: "redirect", redirectTo: FAQ_SETTINGS_PATH });
  const question = normalizeField(formData.get("question"));
  const answerText = normalizeField(formData.get("answerText"));
  const answerContent = renderTextContentToHtml(answerText || "Add answer here.");

  if (answerContent.issues.length > 0) {
    redirect(
      appendAdminToast(
        FAQ_SETTINGS_PATH,
        "error",
        `FAQ answer issue on line ${answerContent.issues[0].line}: ${answerContent.issues[0].message}`,
      ),
    );
  }

  const current = await getManagedFaqItems();
  const next = reindex([
    ...current,
    {
      id: crypto.randomUUID(),
      question: question || "New FAQ",
      answerHtml: answerContent.html,
      sortOrder: current.length,
      showOnFaqPage: formData.get("showOnFaqPage") === "on",
    },
  ]);
  await saveManagedFaqItems(next);
  redirect(appendAdminToast(FAQ_SETTINGS_PATH, "success", "FAQ added."));
}

export async function updateFaq(formData: FormData) {
  await requireAdminSeoWriteAccess({ onDenied: "redirect", redirectTo: FAQ_SETTINGS_PATH });
  const id = normalizeField(formData.get("id"));
  if (!id) throw new Error("FAQ id is required.");

  const question = normalizeField(formData.get("question"));
  const answerText = normalizeField(formData.get("answerText"));
  const showOnFaqPage = formData.get("showOnFaqPage") === "on";
  const answerContent = renderTextContentToHtml(answerText);
  if (!question || !answerText) {
    throw new Error("Question and answer are required.");
  }
  if (answerContent.issues.length > 0) {
    redirect(
      appendAdminToast(
        FAQ_SETTINGS_PATH,
        "error",
        `FAQ answer issue on line ${answerContent.issues[0].line}: ${answerContent.issues[0].message}`,
      ),
    );
  }

  const current = await getManagedFaqItems();
  const next = reindex(
    current.map((item) =>
      item.id === id
        ? {
            ...item,
            question,
            answerHtml: answerContent.html,
            showOnFaqPage,
          }
        : item
    )
  );
  await saveManagedFaqItems(next);
  redirect(appendAdminToast(FAQ_SETTINGS_PATH, "success", "FAQ saved."));
}

export async function deleteFaq(formData: FormData) {
  await requireAdminSeoWriteAccess({ onDenied: "redirect", redirectTo: FAQ_SETTINGS_PATH });
  const id = normalizeField(formData.get("id"));
  if (!id) throw new Error("FAQ id is required.");

  const current = await getManagedFaqItems();
  const next = reindex(current.filter((item) => item.id !== id));
  await saveManagedFaqItems(next);
  redirect(appendAdminToast(FAQ_SETTINGS_PATH, "success", "FAQ deleted."));
}

export async function moveFaqUp(formData: FormData) {
  await requireAdminSeoWriteAccess({ onDenied: "redirect", redirectTo: FAQ_SETTINGS_PATH });
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
  await requireAdminSeoWriteAccess({ onDenied: "redirect", redirectTo: FAQ_SETTINGS_PATH });
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

export async function updateFaqOrder(
  updates: { id: string; sortOrder: number }[]
): Promise<{ error: string | null }> {
  try {
    await requireAdminSeoWriteAccess();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to save FAQ order." };
  }
  if (!Array.isArray(updates) || updates.length === 0) {
    return { error: null };
  }

  const current = await getManagedFaqItems();
  const byId = new Map(current.map((item) => [item.id, item]));
  const next = updates
    .map((update) => {
      const item = byId.get(update.id);
      if (!item) return null;
      return {
        ...item,
        sortOrder: Number.isFinite(update.sortOrder) ? update.sortOrder : item.sortOrder,
      };
    })
    .filter((item): item is ManagedFaqItem => Boolean(item))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item, index) => ({ ...item, sortOrder: index }));

  try {
    await saveManagedFaqItems(next);
    return { error: null };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to save FAQ order." };
  }
}
