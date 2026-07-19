type RateLimitOptions = {
  windowMs: number;
  max: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5_000;
let lastCleanupAt = 0;

function cleanupExpiredBuckets(now: number) {
  if (now - lastCleanupAt < 60_000 && buckets.size < MAX_BUCKETS) return;
  lastCleanupAt = now;
  for (const [key, bucket] of buckets) {
    if (now > bucket.resetAt) buckets.delete(key);
  }
  if (buckets.size < MAX_BUCKETS) return;
  const overflow = buckets.size - MAX_BUCKETS + 1;
  Array.from(buckets.keys())
    .slice(0, overflow)
    .forEach((key) => buckets.delete(key));
}

export function rateLimit(key: string, options: RateLimitOptions) {
  const now = Date.now();
  cleanupExpiredBuckets(now);
  const normalizedKey = key.slice(0, 300);
  const existing = buckets.get(normalizedKey);
  if (!existing || now > existing.resetAt) {
    const resetAt = now + options.windowMs;
    buckets.set(normalizedKey, { count: 1, resetAt });
    return { ok: true, retryAfterSeconds: Math.ceil(options.windowMs / 1000) };
  }
  if (existing.count >= options.max) {
    const retryAfterSeconds = Math.ceil((existing.resetAt - now) / 1000);
    return { ok: false, retryAfterSeconds };
  }
  existing.count += 1;
  return { ok: true, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) };
}

export function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") || "unknown";
}
