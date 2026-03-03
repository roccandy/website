"use server";

import { supabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const PATH = "/admin/flavors";

export async function insertFlavor(name: string): Promise<{ error: string | null }> {
  const trimmed = name?.toString().trim();
  if (!trimmed) return { error: "Flavor name required." };

  const client = supabaseServerClient;
  const { error } = await client.from("flavors").insert({ name: trimmed });
  if (error) return { error: error.message };
  return { error: null };
}

export async function deleteFlavor(formData: FormData) {
  const id = formData.get("id")?.toString();
  if (!id) throw new Error("Missing id");
  const client = supabaseServerClient;
  const { error } = await client.from("flavors").delete().eq("id", id);
  if (error) throw new Error(error.message);
  redirect(PATH);
}
