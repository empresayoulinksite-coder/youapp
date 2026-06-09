import { supabase } from "@/integrations/supabase/client";

export async function uploadImage(
  bucket: "store-images" | "menu-images" | "story-media" | "store-reels" | "store-feed",
  file: File,
  pathPrefix?: string,
): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const base = `${crypto.randomUUID()}.${ext}`;
  const path = pathPrefix ? `${pathPrefix.replace(/\/+$/, "")}/${base}` : base;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Run async tasks with a concurrency limit. Useful for bulk uploads:
 * uploading dozens of files in parallel saturates the browser/network and
 * causes requests to stall indefinitely.
 */
export async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      await worker(items[i], i);
    }
  });
  await Promise.all(runners);
}
