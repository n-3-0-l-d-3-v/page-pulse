import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let limiter: Ratelimit | null | undefined;

/**
 * 10 audits per minute per IP. Optional, same reasoning as lib/redis.ts —
 * absent Upstash env vars, this no-ops rather than blocking requests.
 */
function getLimiter(): Ratelimit | null {
  if (limiter !== undefined) return limiter;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    limiter = null;
    return limiter;
  }
  limiter = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(10, "1 m"),
    prefix: "ratelimit:audit",
  });
  return limiter;
}

export async function checkRateLimit(identifier: string): Promise<boolean> {
  const rl = getLimiter();
  if (!rl) return true; // not configured -> allow
  const { success } = await rl.limit(identifier);
  return success;
}
