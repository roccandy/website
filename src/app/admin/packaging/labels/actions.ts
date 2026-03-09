"use server";

import { requireAdminWriteAccess } from "@/lib/adminAuth";
import { supabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const SHAPES = new Set(["square", "rectangular", "circle"]);

export async function upsertLabelType(formData: FormData) {
  await requireAdminWriteAccess();
  const id = formData.get("id")?.toString() || undefined;
  const shape = formData.get("shape")?.toString() ?? "";
  const dimensions = formData.get("dimensions")?.toString() ?? "";
  const cost = Number(formData.get("cost"));

  if (!shape || !SHAPES.has(shape)) throw new Error("Invalid label shape");
  if (!dimensions.trim()) throw new Error("Label dimensions are required");
  if (!Number.isFinite(cost)) throw new Error("Label cost is required");

  const client = supabaseServerClient;

  if (id) {
    const { error } = await client
      .from("label_types")
      .update({ shape, dimensions: dimensions.trim(), cost })
      .eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await client.from("label_types").insert({ shape, dimensions: dimensions.trim(), cost });
    if (error) throw new Error(error.message);
  }

  redirect("/admin/packaging/labels");
}

export async function deleteLabelType(formData: FormData) {
  await requireAdminWriteAccess();
  const id = formData.get("id")?.toString();
  if (!id) throw new Error("Missing id");
  const client = supabaseServerClient;
  const { error } = await client.from("label_types").delete().eq("id", id);
  if (error) throw new Error(error.message);
  redirect("/admin/packaging/labels");
}
