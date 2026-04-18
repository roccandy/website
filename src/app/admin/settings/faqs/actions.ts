"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getChangedFieldLabels, logAdminActivity } from "@/lib/adminActivity";
import { appendAdminToast, requireAdminSeoWriteAccess } from "@/lib/adminAuth";
import { getManagedFaqItems, saveManagedFaqItems, type ManagedFaqItem } from "@/lib/faqs";
import { buildManagedSitePageHref, EDITABLE_SITE_PAGE_SLUGS } from "@/lib/sitePages";
import { renderTextContentToHtml } from "@/lib/textContentEditor";

const FAQ_SETTINGS_PATH = "/admin/settings/faqs";

function normalizeField(value: FormDataEntryValue | null) {
  return (value?.toString() ?? "").replace(/\r\n/g, "\n").trim();
}

function reindex(items: ManagedFaqItem[]): ManagedFaqItem[] {
  return items.map((item, index) => ({ ...item, sortOrder: index }));
}

function revalidateFaqDependentPages() {
  const paths = new Set<string>(EDITABLE_SITE_PAGE_SLUGS.map((slug) => buildManagedSitePageHref(slug)));
  paths.add("/faq");
  paths.add("/faqs");

  for (const path of paths) {
    revalidatePath(path);
  }
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
  revalidateFaqDependentPages();
  const addedFaq = next[next.length - 1];
  const addedFaqLabel = addedFaq?.question ?? question ?? "New FAQ";
  await logAdminActivity({
    area: "content-seo",
    action: "created",
    entityType: "faq",
    entityId: addedFaq?.id ?? null,
    entityLabel: addedFaqLabel,
    summary: `Added FAQ "${addedFaqLabel}".`,
    path: FAQ_SETTINGS_PATH,
    changedFields: ["Question", "Answer", "FAQ page visibility"],
  });
  redirect(appendAdminToast(FAQ_SETTINGS_PATH, "success", "FAQ added."));
}

export async function updateFaq(formData: FormData) {
  try {
    await requireAdminSeoWriteAccess();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to save FAQ." };
  }

  const id = normalizeField(formData.get("id"));
  if (!id) {
    return { error: "FAQ id is required." };
  }

  const question = normalizeField(formData.get("question"));
  const answerText = normalizeField(formData.get("answerText"));
  const showOnFaqPage = formData.get("showOnFaqPage") === "on";
  const answerContent = renderTextContentToHtml(answerText);

  if (!question || !answerText) {
    return { error: "Question and answer are required." };
  }

  if (answerContent.issues.length > 0) {
    return {
      error: `FAQ answer issue on line ${answerContent.issues[0].line}: ${answerContent.issues[0].message}`,
    };
  }

  const current = await getManagedFaqItems();
  const previousItem = current.find((item) => item.id === id) ?? null;
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

  try {
    await saveManagedFaqItems(next);
    revalidateFaqDependentPages();
    const updatedItem = next.find((item) => item.id === id) ?? null;
    if (previousItem && updatedItem) {
      await logAdminActivity({
        area: "content-seo",
        action: "updated",
        entityType: "faq",
        entityId: updatedItem.id,
        entityLabel: updatedItem.question,
        summary: `Updated FAQ "${updatedItem.question}".`,
        path: FAQ_SETTINGS_PATH,
        changedFields: getChangedFieldLabels(
          {
            question: previousItem.question,
            answerHtml: previousItem.answerHtml,
            showOnFaqPage: previousItem.showOnFaqPage,
          },
          {
            question: updatedItem.question,
            answerHtml: updatedItem.answerHtml,
            showOnFaqPage: updatedItem.showOnFaqPage,
          },
          {
            question: "Question",
            answerHtml: "Answer",
            showOnFaqPage: "FAQ page visibility",
          },
        ),
      });
    }
    return { error: null };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to save FAQ." };
  }
}

export async function deleteFaq(formData: FormData) {
  await requireAdminSeoWriteAccess({ onDenied: "redirect", redirectTo: FAQ_SETTINGS_PATH });
  const id = normalizeField(formData.get("id"));
  if (!id) throw new Error("FAQ id is required.");

  const current = await getManagedFaqItems();
  const removedFaq = current.find((item) => item.id === id) ?? null;
  const next = reindex(current.filter((item) => item.id !== id));
  await saveManagedFaqItems(next);
  revalidateFaqDependentPages();
  if (removedFaq) {
    await logAdminActivity({
      area: "content-seo",
      action: "deleted",
      entityType: "faq",
      entityId: removedFaq.id,
      entityLabel: removedFaq.question,
      summary: `Deleted FAQ "${removedFaq.question}".`,
      path: FAQ_SETTINGS_PATH,
      changedFields: ["FAQ"],
    });
  }
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
  revalidateFaqDependentPages();
  await logAdminActivity({
    area: "content-seo",
    action: "reordered",
    entityType: "faq",
    entityId: current[index]?.id ?? id,
    entityLabel: current[index]?.question ?? "FAQ",
    summary: `Moved FAQ "${current[index]?.question ?? "FAQ"}" up.`,
    path: FAQ_SETTINGS_PATH,
    changedFields: ["Sort order"],
  });
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
  revalidateFaqDependentPages();
  await logAdminActivity({
    area: "content-seo",
    action: "reordered",
    entityType: "faq",
    entityId: current[index]?.id ?? id,
    entityLabel: current[index]?.question ?? "FAQ",
    summary: `Moved FAQ "${current[index]?.question ?? "FAQ"}" down.`,
    path: FAQ_SETTINGS_PATH,
    changedFields: ["Sort order"],
  });
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
    revalidateFaqDependentPages();
    await logAdminActivity({
      area: "content-seo",
      action: "reordered",
      entityType: "faq-library",
      entityLabel: "FAQ library",
      summary: "Saved the FAQ order.",
      path: FAQ_SETTINGS_PATH,
      changedFields: ["Sort order"],
      metadata: {
        itemCount: next.length,
      },
    });
    return { error: null };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to save FAQ order." };
  }
}
