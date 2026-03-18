import { supabaseServerClient } from "@/lib/supabase/server";

export type StorageObjectInfo = {
  path: string;
  contentType: string | null;
  sizeBytes: number | null;
};

function readMetadataValue(record: Record<string, unknown> | null | undefined, key: string) {
  const value = record?.[key];
  return typeof value === "string" || typeof value === "number" ? value : null;
}

export async function listBucketObjectInfo(bucket: string, prefix = ""): Promise<StorageObjectInfo[]> {
  const { data, error } = await supabaseServerClient.storage.from(bucket).list(prefix, {
    limit: 1000,
    sortBy: { column: "name", order: "asc" },
  });

  if (error) {
    throw new Error(error.message);
  }

  const entries = data ?? [];
  const files: StorageObjectInfo[] = [];

  for (const entry of entries) {
    const itemPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.id) {
      const metadata = (entry.metadata ?? null) as Record<string, unknown> | null;
      const size = readMetadataValue(metadata, "size");
      const mimetype = readMetadataValue(metadata, "mimetype");
      files.push({
        path: itemPath,
        contentType: typeof mimetype === "string" ? mimetype : null,
        sizeBytes: typeof size === "number" ? size : null,
      });
      continue;
    }

    files.push(...(await listBucketObjectInfo(bucket, itemPath)));
  }

  return files;
}
