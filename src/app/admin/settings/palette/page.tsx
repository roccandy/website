import { getColorPalette } from "@/lib/data";
import { requireAdminSession, requireAdminWriteAccess } from "@/lib/adminAuth";
import { supabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ColorPaletteEditor } from "@/app/admin/settings/ColorPaletteEditor";
import { paletteSections } from "@/app/admin/settings/palette";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

function normalizeHex(value: FormDataEntryValue | null, fallback: string) {
  if (!value) return fallback;
  const raw = value.toString().trim().toLowerCase();
  if (!raw) return fallback;
  const withHash = raw.startsWith("#") ? raw : `#${raw}`;
  if (/^#[0-9a-f]{3}$/.test(withHash)) {
    const [, r, g, b] = withHash;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  if (/^#[0-9a-f]{6}$/.test(withHash)) {
    return withHash;
  }
  return fallback;
}

async function updateColorPalette(formData: FormData) {
  "use server";
  await requireAdminWriteAccess({ onDenied: "redirect", redirectTo: "/admin/settings/palette" });

  const client = supabaseServerClient;
  const rows = paletteSections.flatMap((section, sectionIndex) =>
    section.items.map((item, itemIndex) => ({
      category: item.categoryKey,
      shade: item.shadeKey,
      hex: normalizeHex(formData.get(item.name), item.defaultValue),
      sort_order: sectionIndex * 10 + itemIndex,
    })),
  );
  const { error } = await client.from("color_palette").upsert(rows, {
    onConflict: "category,shade",
  });

  if (error) {
    throw new Error(error.message);
  }

  redirect("/admin/settings/palette");
}

export default async function SettingsPalettePage() {
  await requireAdminSession();

  const palette = await getColorPalette();
  const paletteLookup = new Map(palette.map((row) => [`${row.category}:${row.shade}`, row.hex]));
  const paletteValues = Object.fromEntries(
    paletteSections.flatMap((section) =>
      section.items.map((item) => [
        item.name,
        paletteLookup.get(`${item.categoryKey}:${item.shadeKey}`) ?? item.defaultValue,
      ]),
    ),
  );

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Admin / Settings</p>
        <h2 className="text-3xl font-semibold">Colour palette</h2>
        <p className="text-sm text-zinc-600">
          Update the palette used in order creation. Values are stored as hex and previewed with CMYK.
        </p>
      </div>

      <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <form action={updateColorPalette} className="space-y-6">
          <ColorPaletteEditor initialValues={paletteValues} />
          <div>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              Save palette
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
