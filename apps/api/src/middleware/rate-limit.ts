/**
 * Simple in-memory rate limiter.
 * NOTE: resets on process restart and does not share state across replicas.
 * Sufficient for a single-instance deployment; replace with Redis-backed
 * solution if horizontal scaling is needed.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Prune expired entries every 5 minutes to avoid unbounded memory growth
setInterval(
  () => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  },
  5 * 60 * 1000,
).unref();

export function rateLimit(options: { limit: number; windowMs: number }) {
  const { limit, windowMs } = options;

  return async function rateLimitMiddleware(
    c: { req: { header: (name: string) => string | undefined }; json: (body: unknown, status: number) => Response },
    next: () => Promise<void>,
  ) {
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("x-real-ip") ??
      "unknown";
    const key = `${ip}:${c.req.header("host") ?? ""}`;

    const now = Date.now();
    let bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 1, resetAt: now + windowMs };
      buckets.set(key, bucket);
    } else {
      bucket.count++;
    }

    if (bucket.count > limit) {
      return c.json({ error: "Too many requests, please try again later" }, 429);
    }

    await next();
  };
}
