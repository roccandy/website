"use server";

import { getChangedFieldLabels, logAdminActivity } from "@/lib/adminActivity";
import { requireAdminWriteAccess } from "@/lib/adminAuth";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

const SHAPES = new Set(["square", "rectangular", "circle"]);

export async function upsertLabelType(formData: FormData) {
  await requireAdminWriteAccess({ onDenied: "redirect", redirectTo: "/admin/packaging/labels" });
  const id = formData.get("id")?.toString() || undefined;
  const shape = formData.get("shape")?.toString() ?? "";
  const dimensions = formData.get("dimensions")?.toString() ?? "";
  const cost = Number(formData.get("cost"));

  if (!shape || !SHAPES.has(shape)) throw new Error("Invalid label shape");
  if (!dimensions.trim()) throw new Error("Label dimensions are required");
  if (!Number.isFinite(cost)) throw new Error("Label cost is required");

  const client = supabaseAdminClient;
  const existingType = id
    ? (await client.from("label_types").select("id,shape,dimensions,cost").eq("id", id).maybeSingle()).data
    : null;

  if (id) {
    const { data, error } = await client
      .from("label_types")
      .update({ shape, dimensions: dimensions.trim(), cost })
      .eq("id", id)
      .select("id,shape,dimensions,cost")
      .single();
    if (error) throw new Error(error.message);
    await logAdminActivity({
      area: "commercial",
      action: "updated",
      entityType: "label-type",
      entityId: data?.id ?? id,
      entityLabel: data ? `${data.shape} ${data.dimensions}` : dimensions.trim(),
      summary: `Updated label type ${data ? `${data.shape} ${data.dimensions}` : dimensions.trim()}.`,
      path: "/admin/packaging/labels",
      changedFields: getChangedFieldLabels(
        {
          shape: existingType?.shape ?? null,
          dimensions: existingType?.dimensions ?? null,
          cost: existingType?.cost ?? null,
        },
        {
          shape: data?.shape ?? shape,
          dimensions: data?.dimensions ?? dimensions.trim(),
          cost: data?.cost ?? cost,
        },
        {
          shape: "Shape",
          dimensions: "Dimensions",
          cost: "Cost",
        },
      ),
    });
  } else {
    const { data, error } = await client
      .from("label_types")
      .insert({ shape, dimensions: dimensions.trim(), cost })
      .select("id,shape,dimensions,cost")
      .single();
    if (error) throw new Error(error.message);
    await logAdminActivity({
      area: "commercial",
      action: "created",
      entityType: "label-type",
      entityId: data?.id ?? null,
      entityLabel: data ? `${data.shape} ${data.dimensions}` : dimensions.trim(),
      summary: `Added label type ${data ? `${data.shape} ${data.dimensions}` : dimensions.trim()}.`,
      path: "/admin/packaging/labels",
      changedFields: ["Shape", "Dimensions", "Cost"],
    });
  }

  redirect("/admin/packaging/labels");
}

export async function deleteLabelType(formData: FormData) {
  await requireAdminWriteAccess({ onDenied: "redirect", redirectTo: "/admin/packaging/labels" });
  const id = formData.get("id")?.toString();
  if (!id) throw new Error("Missing id");
  const client = supabaseAdminClient;
  const { data: existing } = await client.from("label_types").select("id,shape,dimensions").eq("id", id).maybeSingle();
  const { error } = await client.from("label_types").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await logAdminActivity({
    area: "commercial",
    action: "deleted",
    entityType: "label-type",
    entityId: existing?.id ?? id,
    entityLabel: existing ? `${existing.shape} ${existing.dimensions}` : "Label type",
    summary: `Deleted label type${existing ? ` ${existing.shape} ${existing.dimensions}` : ""}.`,
    path: "/admin/packaging/labels",
    changedFields: ["Label type"],
  });
  redirect("/admin/packaging/labels");
}
